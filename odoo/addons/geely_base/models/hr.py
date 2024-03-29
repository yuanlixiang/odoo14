# -*- coding: utf-8 -*-

from dateutil.relativedelta import relativedelta
from odoo import api, fields, models
from odoo.exceptions import UserError
import urllib.request
import urllib.parse
import logging
import json
import sys
import time
from .gbop_utils import GBOPUtils
from datetime import datetime, timedelta, date

_logger = logging.getLogger(__name__)




class HrDepartment(models.Model):
    _inherit = 'hr.department'
    
    g_tenantOrgId = fields.Char('tenantOrgId')
    g_center = fields.Boolean('品牌院/技术中心')
    g_brand = fields.Boolean('品牌院')

    def name_get(self):
        result = []
        for record in self:
            name = record.name
            if record.parent_id:
                name = "%s / %s" % (record.parent_id.name_get()[0][1], name)
            result.append((record.id, name))
        return result


class HrEmployee(models.Model):
    _inherit = 'hr.employee'
    
    g_login = fields.Char('用户名')
    g_manager_name = fields.Char('主管')  # auto domain
    g_soft_id = fields.Char('工号')
    g_grade = fields.Integer('岗级')
    g_com_name = fields.Char('所属公司')
    g_search = fields.Boolean('Search', compute='_company_g_s_login', search='search_g_search')
    g_is_supplier = fields.Boolean('是供应商', default=False)
    g_is_to_update = fields.Boolean('是要被更新', default=True)
    g_s_login = fields.Boolean('搜索用户名', compute='_company_g_s_login', search='search_g_s_login')  # a|b|c
    hiredt = fields.Date(u'入职日期')
    update_time = fields.Datetime(u'同步时间')
    ehrTenantId = fields.Char(string='租户ID')
    ehrCompanyId = fields.Char(string='公司编码')
    original_department_id = fields.Many2one('hr.department', string='原部门')

    def _company_g_s_login(self):
        for res in self:
            res.g_s_login = True
            res.g_search = True

    @api.model
    def create(self, vals):
        res = super(HrEmployee, self).create(vals)

        # e-开头认为是供应商
        g_login = res.g_login
        if not res.g_is_supplier and g_login and g_login.startswith('e-'):
            res.write({'g_is_supplier': True, 'g_is_to_update': False})

        return res

    def write(self, vals):
        # 部门更新时，检查是否是离职部门，是离职部门，将原部门更新
        if 'department_id' in vals:
            leave_department_id = self.env['hr.department'].search([
                ('g_tenantOrgId', '=', '5565')
            ])
            if leave_department_id and vals.get('department_id') and vals.get(
                    'department_id') == leave_department_id.id and self.department_id.id != leave_department_id.id:
                vals['original_department_id'] = self.department_id.id
        res = super(HrEmployee, self).write(vals)
        # 判断is_supplier
        if 'g_is_supplier' in vals:
            geely_supplier_group_id = self.env.ref('geely_base.group_geely_supplier')
            user_ids = [emp.user_id.id for emp in self if emp.user_id]
            if vals.get('g_is_supplier'):
                geely_supplier_group_id.sudo().g_add_users(user_ids)
            else:
                geely_supplier_group_id.sudo().g_remove_users(user_ids)
        
        return res

    def name_get(self):
        if self._context.get('g_show_department'):
            result = []
            for record in self:
                name = '%s - - - %s' % (record.name, record.department_id.name or '')
                result.append((record.id, name))
            return result
        elif self._context.get('g_show_email'):
            result = []
            for record in self:
                name = '%s - - - %s' % (record.name, record.g_login or '')
                result.append((record.id, name))
            return result
        else:
            return super(HrEmployee, self).name_get()
    
    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        domain = args or []
        if name and operator in ['=', 'ilike']:
            return self.search(domain + ['|', '|', '|',
                                         ('name', operator, name),
                                         ('g_login', operator, name),
                                         ('g_soft_id', operator, name),
                                         ('work_email', operator, name)
                                         ], limit=limit).name_get()
        else:
            return super(HrEmployee, self).name_search(name, args=args, operator=operator, limit=limit)
    
    @api.model
    def g_search_multi(self, name):
        return self.search(['|', '|', '|',
                            ('name', '=', name),
                            ('work_email', '=', name),
                            ('g_login', '=', name),
                            ('g_soft_id', '=', name)
                            ], limit=1)
    
    @api.onchange('user_id')
    def g_onchange_user_id(self):
        if self.user_id:
            self.g_login = self.user_id.login
    
    @api.model
    def get_manager_ids(self):
        cr = self._cr
        cr.execute('select g_manager_id from fleet_vehicle group by g_manager_id;')
        res = cr.fetchall()
        manager_ids = []
        if res:
            manager_ids = [r[0] for r in res if r[0]]
        return manager_ids
    
    def search_g_search(self, operator, value):
        if value == 'fleet_manager':
            return [('id', operator, self.get_manager_ids())]
        return [(1, '=', 1)]

    def search_g_s_login(self, operator, value):
        logins = value.split('|')
        return [('g_login', 'in', logins)]

    @api.model
    def g_get_users(self, employee_ids):
        if not employee_ids:
            return []
        cr = self._cr
        cr.execute("""select r.user_id
                    from hr_employee e
                    left join resource_resource r on (e.resource_id=r.id)
                    where e.id in %s""", (tuple(employee_ids),))
        users = [c[0] for c in cr.fetchall() if c[0]]
        return users
    
    @api.model
    def update_employee_from_ehr(self, key, func='empNo'):
        param_obj = self.env['ir.config_parameter']
        baseurl = param_obj.get_param('geely_base.ehr_url')
        # appKey = param_obj.get_param('geely_base.ehr_appKey')
        # sso_key = param_obj.get_param('geely_base.sso_appKey')
        sso_key = param_obj.get_param('geely_base.ehr_appKey')
        gbop_app_access_key = param_obj.get_param('geely_base.gbop_app_access_key')
        gbop_app_secret_key = param_obj.get_param('geely_base.gbop_app_secret_key')
        sys_title = param_obj.get_param('web.base.title')
        email = ''
        login = ''
        empNo = ''
        if func == 'login':
            login = key.lower()
            if '@' not in login:
                email = '%s@geely.com' % login
            elif '@geely.com' in login:
                email = login
                login = login.split('@')[0]
            else:   # 其它公司
                email = login
                # http://gap-service-tenant-auth.prod.app-cloud.geely.com/tenant/user/by-domain-account?tenantId=9999&appKey=317d5a98-c841-4f63-bbef-c11adca1d3ea&domainAccount=hongfei.wu@geely.com
            # url = '%s/tenant/user/by-domain-account?tenantId=9999&appKey=%s&domainAccount=%s' % (baseurl, appKey, email)
            uc_path = "/uc/v1/tenant/user/by-domain-account"
            params = {"domainAccount": email, "ssoKeyId": sso_key}
        elif func == 'name':
            # url = '%ppKey, urllib.parse.quote(key.encode('utf-8')))
            # uc_path = "/uc/v1/tenant/user/by-emp-nos/tenant/user/search/by-name?tenantId=9999&appKey=%s&nameKey=%s&dimensionId=0' % (
            #     baseurl, a"
            uc_path = "/uc/v1/tenant/user/search/by-name"
            params = {"nameKey": key, "ssoKeyId": sso_key}
        else:  # empNo
            empNo = key
            # 	http://gap-service-tenant-auth.prod.app-cloud.geely.com/tenant/user/by-emp-no?tenantId=9999&appKey=317d5a98-c841-4f63-bbef-c11adca1d3ea&empNo=0249018
            # url = '%s/tenant/user/by-emp-no?tenantId=9999&appKey=%s&empNo=%s' % (baseurl, appKey, key)
            uc_path = "/uc/v1/tenant/user/by-emp-no"
            params = {"empNo": empNo, "ssoKeyId": sso_key}
        result = {
            'login': login,
            'g_soft_id': empNo
        }
        try:
            # data = urllib.request.urlopen(url)
            # content = data.read()
            # content = json.loads(content)
            gbop = GBOPUtils(host=baseurl, method="GET", path=uc_path,
                             params=params,
                             access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)
            res = gbop.get_resp_data()
            content = res.json()
            if func == 'name':
                return content['data']
            else:
                info = content['data']
                self.ehr_update_employee(func, info, result, login, empNo)
        except Exception as e:
            _logger.warning('----------------------------update employee from ehr failed: %s' % str(e))
        return result

    @api.model
    def move_empl_to_leave_department(self, login):
        """将员工挪动到离职部门"""
        leave_department_id = self.env['hr.department'].search([
            ('g_tenantOrgId', '=', '5565')
        ])
        if not leave_department_id:
            return
        root_deprtment_id = self.env['hr.department'].search([('name', '=', '研发系统')], limit=1)
        if not root_deprtment_id:
            return
        employee_id = self.search([
            ('g_login', '=', login),
            ('department_id', 'child_of', root_deprtment_id.id)
        ], limit=1)
        if not employee_id:
            return
        employee_id.write({
            'department_id': leave_department_id.id
        })

    @api.model
    def ehr_update_employee(self, func, info, result, login, empNo, cache={}):
        # ('all', info, result, '', '', cache)
        department_obj = self.env['hr.department']
        # job_obj = self.env['hr.job']
        cr = self._cr
        if func != 'login':
            login = info.get('domainAccountList') and info.get('domainAccountList')[0]['domainAccount'] or ''
            login = login.lower()
            if '@geely.com' in login:
                login = login.split('@')[0]
            result['login'] = login
        employee_vals = {
            'g_login': login,
            'work_email': info.get('email') or (login and '%s@geely.com' % login or ''),
            'work_phone': info.get('phone') or '',
            'update_time': fields.Datetime.now(),
        }
        name = info.get('nickName').replace("'", '-')
        job_name = info.get('position')
        if job_name:
            job_name = job_name.replace("'", '-')
        supervisorId = info.get('supervisorId')  # 上级领导
        # parent_id = False
        empNo = info.get('empNo') or empNo
        tenantOrgs_key = 'tenantDeps'
        # if func == 'name':
        #     tenantOrgs_key = 'tenantOrgs'
        tenantOrgs = info.get(tenantOrgs_key)
        grade = info.get('grade')
        hiredt = info.get('lastHireDT')
        # 租户ID
        ehrTenantId = info.get('ehrTenantId')
        # tenantComs = info.get('tenantComs')
        if name:
            employee_vals['name'] = name
        if empNo:
            employee_vals['g_soft_id'] = empNo
            result['g_soft_id'] = empNo
        if hiredt:
            hiredt_str = str(hiredt)
            hiredt_array = time.localtime(int(hiredt_str[0:10]))
            hiredt_format = time.strftime('%Y-%m-%d', hiredt_array)
            hiredt_date = datetime.strptime(hiredt_format, '%Y-%m-%d')
            hiredt_date_1 = hiredt_date + timedelta(days=1)
            hiredt_format_end = hiredt_date_1.strftime('%Y-%m-%d')
            employee_vals['hiredt'] = hiredt_format_end
        # 存在就更新到用户数据中
        if ehrTenantId:
            employee_vals['ehrTenantId'] = ehrTenantId
        if job_name:
            # job_id = job_obj.search([('name', '=', job_name)], limit=1)
            # if not job_id:
            #     job_id = job_obj.create({'name': job_name})
            # employee_vals['job_id'] = job_id.id
            job_id = False
            if func == 'all':
                job_id = cache['job'].get(job_name) or False
            else:
                job_id = False
            if not job_id:
                job_id = self.g_get_or_create_job('hr.job', job_name)
                if func == 'all':
                    cache['job'][job_name] = job_id
            employee_vals['job_id'] = job_id
        if tenantOrgs:
            tenantOrg = self.ehr_parse_tenantOrgs(tenantOrgs)
            department_name = tenantOrg['orgName']
            tenantOrgId = tenantOrg['tenantOrgId']
            # 如果用户中心的部门名称与系统里的不一致，则将系统里的部门名称修改为与用户中心的一致
            department = department_obj.search([('g_tenantOrgId', '=', tenantOrgId)], limit=1)
            if department and department.name != department_name:
                department.name = department_name

            if func == 'all' and tenantOrgId:
                department_id = cache['department'].get(tenantOrgId) or False
            else:
                department_id = False
            if not department_id:
                if tenantOrgId:
                    cr.execute("""select id,"g_tenantOrgId",parent_id from hr_department where "g_tenantOrgId"='%s' and active=true limit 1""" % tenantOrgId)
                else:
                    cr.execute("""select id,"g_tenantOrgId",parent_id from hr_department where name='%s' and active=true limit 1""" % department_name)
                res = cr.fetchone()     # 有同名的部门，改为按照g_tenantOrgId搜索
                if res:
                    print('********res*********')
                    department_id = res[0]
                    if tenantOrgId and not res[1]:
                        cr.execute("""update hr_department set "g_tenantOrgId" = '%s' where id=%d""" % (tenantOrgId, department_id))
                else:
                    cr.execute("""insert into hr_department (name,active,"g_tenantOrgId")
                                  values ('%s',true,'%s') RETURNING id""" % (department_name, tenantOrgId or ''))
                    department_id = cr.fetchone()[0]
                # if tenantOrgId and (not res or not res[2]):
                if tenantOrgId:
                    self.update_department_parent_from_ehr(department_id, tenantOrgId)
                if tenantOrgId and func == 'all':
                    cache['department'][tenantOrgId] = department_id
            employee_vals['department_id'] = department_id
            if func != 'all':
                result['department_id'] = department_obj.browse(department_id)
            com_name = tenantOrg.get('ehrCompanyName')
            employee_vals['g_com_name'] = com_name
            ehrCompanyId = tenantOrg.get('ehrCompanyId')
            employee_vals['ehrCompanyId'] = ehrCompanyId
            result['com_name'] = com_name
        if grade:
            employee_vals['g_grade'] = grade
            result['g_grade'] = grade
        if supervisorId and supervisorId != empNo:
            if func == 'all':
                parent_id = cache['employee'].get(supervisorId) or False
            else:
                parent_id = False
            if not parent_id:
                parent_id = self.search([('g_soft_id', '=', supervisorId)], limit=1).id
                if not parent_id and not self._context.get('no_update_parent'):
                    parent_vals = self.with_context({'no_update_parent': 1}).update_employee_from_ehr(supervisorId, 'empNo')
                    if 'employee_id' in parent_vals.keys():
                        parent_id = parent_vals['employee_id'].id
                if func == 'all':
                    cache['employee'][supervisorId] = parent_id
            employee_vals['parent_id'] = parent_id
        if login:
            employee_id = self.search([('g_login', '=', login)], limit=1)
            if not employee_id and empNo:
                employee_id = self.search([('g_soft_id', '=', empNo)], limit=1)
        else:  # empNo
            employee_id = self.search([('g_soft_id', '=', empNo)], limit=1)
        # if employee_vals['work_email'] and not employee_id:
        #     # 保证匹配性，忽略邮箱大小写，使用数据库查询增加速度
        #     sql = "select * from resource_resource b left join  hr_employee a  on " \
        #           " a.resource_id = b.id where lower(a.work_email) = '" + employee_vals['work_email'].strip().lower() + "' and b.active=True"
        #     self.env.cr.execute(sql)
        #     employee_dict = self.env.cr.dictfetchall()
        #
        #     if employee_dict:
        #         employee_id = employee_dict[0]['id']
        #         employee_id = self.search([('id', '=', employee_id)], limit=1)
        if employee_id:
            if not employee_id.g_is_to_update:
                employee_vals.pop('g_com_name')
            employee_id.write(employee_vals)
            print('*write**{}:***{}***'.format(employee_vals['name'], employee_vals['work_email']))

        else:
            # 判断员工入职日期大于当前日期，则无需创建员工
            if employee_vals.get('hiredt') and employee_vals['hiredt'] > datetime.now().strftime('%Y-%m-%d %H:%M:%S'):
                pass
            else:
                employee_id = self.create(employee_vals)
                print('*create**{}:***{}***'.format(employee_vals['name'], employee_vals['work_email']))
        if func == 'all' and empNo:
            cache['employee'][empNo] = employee_id.id
        if employee_id.user_id and name:
            employee_id.user_id.write({'name': name})
        # if parent_id:
        #     try:
        #         employee_id.write({'parent_id': parent_id})
        #     except Exception, e:
        #         _logger.error('`````````````````````````````````````%s,%s:%s' % (login, empNo, e))
        result['employee_id'] = employee_id
    
    @api.model
    def ehr_parse_tenantOrgs(self, tenantOrgs):
        if not tenantOrgs:
            return {}
        if len(tenantOrgs) == 1:
            return tenantOrgs[0]
        else:
            res = list(filter(lambda tenantOrg: tenantOrg['isMain'] == 1, tenantOrgs))
            return res and res[0] or tenantOrgs[0]
    
    @api.model
    def update_department_parent_from_ehr(self, department_id, tenantOrgId):
        # if department_id.parent_id:
        #     return
        department_obj = self.env['hr.department']
        param_obj = self.env['ir.config_parameter']
        baseurl = param_obj.get_param('geely_base.ehr_url')
        # url = '%s/tenant/org/search/org?tenantId=9999&tenantOrgId=%s' % (baseurl, tenantOrgId)
        # sso_key = param_obj.get_param('geely_base.sso_appKey')
        sso_key = param_obj.get_param('geely_base.ehr_appKey')
        gbop_app_access_key = param_obj.get_param('geely_base.gbop_app_access_key')
        gbop_app_secret_key = param_obj.get_param('geely_base.gbop_app_secret_key')
        uc_path = "/uc/v1/tenant/org/search/org"
        params = {"tenantOrgId": tenantOrgId, "ssoKeyId": sso_key}
        try:
            # data = urllib.request.urlopen(url)
            # content = data.read()
            # content = json.loads(content)
            gbop = GBOPUtils(host=baseurl, method="GET", path=uc_path,
                             params=params,
                             access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)
            res = gbop.get_resp_data()
            content = res.json()
            info = content['data']
            cr = self._cr
            if not info:
                return
            parentId = info['parentId']
            parent_id = department_obj.search([('g_tenantOrgId', '=', parentId)], limit=1)
            if parent_id:
                # department_id.write({'parent_id': parent_id.id})
                cr.execute("""update hr_department set parent_id = %d where id=%d""" % (parent_id.id, department_id))
                # self.update_department_parent_from_ehr(parent_id, parentId)
                return
            # new_url = '%s/tenant/org/search/org?tenantId=9999&tenantOrgId=%s' % (baseurl, parentId)
            # new_data = urllib.request.urlopen(new_url)
            # new_content = new_data.read()
            # new_content = json.loads(new_content)
            params = {"tenantOrgId": parentId, "ssoKeyId": sso_key}
            gbop = GBOPUtils(host=baseurl, method="GET", path=uc_path,
                             params=params,
                             access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)
            res = gbop.get_resp_data()
            new_content = res.json()
            new_info = new_content['data']
            if new_info:
                parent_name = new_info['orgName']
                if parent_name:
                    parent_name = parent_name.replace("'", '-')
                p_parentId = new_info['parentId']
                p_parent_id = department_obj.search([('g_tenantOrgId', '=', p_parentId)], limit=1)
                parent_id = department_obj.create({'name': parent_name, 'g_tenantOrgId': parentId, 'parent_id': p_parent_id.id})
                cr.execute("""update hr_department set parent_id = %d where id=%d""" % (parent_id.id, department_id))
                # self.update_department_parent_from_ehr(parent_id, parentId)
        except Exception as e:
            _logger.warning('----------------------------update department from ehr failed: %s' % str(e))
    
    @api.model
    def ehr_employee_wizard(self, name, method=None, filter_company=None, hide_no=False):
        infos = self.sudo().update_employee_from_ehr(name, 'name')
        line_ids = []
        _logger.warning('---------infos：---{}----------------'.format(infos))
        for info in infos:
            tenantOrg = self.ehr_parse_tenantOrgs(info.get('tenantDeps'))
            company = tenantOrg and tenantOrg.get('ehrCompanyName') or ''
            if filter_company and company != filter_company:
                continue
            line_ids.append((0, 0, {
                'name': info.get('nickName') or '',
                'g_soft_id': info.get('empNo') or '',
                'g_login': info.get('domainAccountList') and info.get('domainAccountList')[0]['domainAccount'] or '',
                'department': tenantOrg and tenantOrg['orgName'] or '',
                'company': company,
                'phone': info.get('phone') or '',
                'email': info.get('email') or '',
                # 'position': info.get('position') or '',
                'data': json.dumps(info)
            }))
        return {
            'name': '查询员工',
            'type': 'ir.actions.act_window',
            'res_model': 'geely.ehr.employee.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_line_ids': line_ids, 'callback_method': method, 'hide_no': hide_no}
        }

    @api.model
    def g_get_or_create_job(self, model, value):
        # todo 改成通用的g_get_or_create_record，包含额外的字段
        cr = self._cr
        table = model.replace('.', '_')
        cr.execute("""select id from %s where name='%s' limit 1""" % (table, value))
        res = cr.fetchone()
        if res:
            return res[0]
        cr.execute("""insert into %s (name, state)
                    values ('%s', 'recruit') RETURNING id""" % (table, value))
        return cr.fetchone()[0]

    @api.model
    def cron_update_employee_all_from_ehr(self, ids=None):
        """
            创建一个更新主公司员工的job，多个公司或部门复制该函数修改tenantOrgId即可
        :param ids:
        :return:
        """
        param_obj = self.env['ir.config_parameter']
        tenantOrgId = param_obj.get_param('geely_base.ehr_tenantOrgId')
        tenantOrgIds = tenantOrgId.split(',')
        for tenantOrgId in tenantOrgIds:
            self.update_employee_department_from_ehr(tenantOrgId)

    # @api.model
    # def cron_update_employee_from_leave_department(self):
    #     """从离职部门更新员工，若是调动则更新到新部门"""
    #     leave_department_id = self.env['hr.department'].search([
    #         ('g_tenantOrgId', '=', '5565')
    #     ], limit=1)
    #     if not leave_department_id:
    #         return
    #     today = fields.Datetime.now()
    #     deadline = today - relativedelta(days=2)
    #     department_id = self.env['hr.department'].search([('name', '=', '研发系统')], limit=1)
    #     employee_ids = self.env['hr.employee'].search(['|',
    #         ('update_time', '=', False),
    #         ('update_time', '<', deadline),
    #         ("parent_id", "child_of", department_id.id),
    #         ('department_id', '!=', leave_department_id.id),
    #     ])
    #     for employee_id in employee_ids:
    #         try:
    #             employee_id.sudo().update_employee_from_ehr(
    #                 employee_id.g_login, 'login'
    #             )
    #         except:
    #             _logger.error('-----------------------------员工<%s>更新离职部门信息失败', employee_id.name)

    @api.model
    def cron_update_employee_from_leave_department(self):
        """从离职部门更新员工，若是调动则更新到新部门"""
        leave_department_id = self.env['hr.department'].sudo().search([
            ('g_tenantOrgId', '=', '5565')
        ], limit=1)
        if not leave_department_id:
            return
        # 获取已离职的员工工号
        hr_employee_ids = self.env['hr.employee'].sudo().synchronization_user_turnover_get()
        _logger.warning('=====================leave employees is %s', hr_employee_ids)
        # 查询出已离职的员工信息
        hr_employee_id = self.env['hr.employee'].sudo().search([
            ('g_soft_id', 'in', hr_employee_ids)
        ])
        # 修改员工部门到离职
        for hr_employee_item in hr_employee_id:
            hr_employee_item.department_id = leave_department_id.id
            hr_employee_item.update_time = fields.Datetime.now()

    # 用户中心增量离职缓存接口
    def synchronization_user_turnover_get(self):
        param_obj = self.env['ir.config_parameter']
        baseurl = param_obj.get_param('geely_base.ehr_url')

        gbop_app_access_key = param_obj.get_param('geely_base.gbop_app_access_key')
        gbop_app_secret_key = param_obj.get_param('geely_base.gbop_app_secret_key')
        params = {}
        uc_path = '/uc/v1/tenant/user/cache/dimission'
        gbop = GBOPUtils(host=baseurl, method="GET", path=uc_path,
                         params=params,
                         access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)
        res = gbop.get_resp_data()
        content = res.json()
        # print(content['data'])
        return content['data']

    @api.model
    def update_employee_department_from_ehr(self, tenantOrgId):
        # 更新部门所有员工信息
        _logger.warning('-----------------------------update employee from ehr start')
        param_obj = self.env['ir.config_parameter']
        baseurl = param_obj.get_param('geely_base.ehr_url')
        appKey = param_obj.get_param('geely_base.ehr_appKey')
        # url = '%s/tenant/user/allUserByOrg?tenantId=9999&tenantOrgId=%s&dimensionId=0&appKey=%s' % (
        #     baseurl, tenantOrgId, appKey)
        # res = []
        # sso_key = param_obj.get_param('geely_base.sso_appKey')
        sso_key = param_obj.get_param('geely_base.ehr_appKey')
        gbop_app_access_key = param_obj.get_param('geely_base.gbop_app_access_key')
        gbop_app_secret_key = param_obj.get_param('geely_base.gbop_app_secret_key')
        uc_path = "/uc/v1/tenant/user/allUserByOrg"
        params = {"tenantOrgId": tenantOrgId, "ssoKeyId": sso_key}
        try:
            # data = urllib.request.urlopen(url)
            # content = data.read()
            # content = json.loads(content)
            gbop = GBOPUtils(host=baseurl, method="GET", path=uc_path,
                             params=params,
                             access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)
            res = gbop.get_resp_data()
            content = res.json()
            cache = {
                'department': {},
                'job': {},
                'employee': {}
            }
            if 'data' in content.keys():
                print(len(content['data']))
                for info in content['data']:
                    result = {}
                    self.ehr_update_employee('all', info, result, '', '', cache)
            else:
                _logger.warning('----------------------------update employee from ehr failed: 权限不足，没用用户详细信息')
                # res.append(result.copy())
        except Exception as e:
            _logger.warning('----------------------------update employee from ehr failed: %s' % str(e))
        # _logger.warning('-----------------------------update employee from ehr end')

    def action_to_update_users(self):
        user_ids = []
        for per in self:
            if not per.user_id and per.g_login:
                user_ids.append({
                    'name': per.name,
                    'login': per.g_login
                })
        self.env['res.users'].create(user_ids)


class EhrEmpolyeeWizard(models.TransientModel):
    _name = 'geely.ehr.employee.wizard'
    _description = '查询员工'
    
    line_ids = fields.One2many('geely.ehr.employee.wizard.line', 'wizard_id', '员工详情')

    def btn_confirm(self):
        select_line = self.line_ids.filtered(lambda l: l.select)
        if not select_line:
            raise UserError('请选择一个员工！')
        if len(select_line) > 1:
            raise UserError('只能选择一个员工！')
        result = {
            'login': '',
            'g_soft_id': ''
        }
        info = json.loads(select_line.data)
        self.env['hr.employee'].sudo().ehr_update_employee('name', info, result, '', '')
        callback_method = self._context.get('callback_method')
        if callback_method:
            record = self.env[self._context['active_model']].browse(self._context['active_id'])
            getattr(record, callback_method)(result)


class EhrEmpolyeeWizardLine(models.TransientModel):
    _name = 'geely.ehr.employee.wizard.line'
    _description = '查询员工详情'
    
    wizard_id = fields.Many2one('geely.ehr.employee.wizard', '查询员工')
    select = fields.Boolean('选择')
    data = fields.Text('内容')
    name = fields.Char('姓名')
    g_soft_id = fields.Char('工号')
    g_login = fields.Char('用户名')
    department = fields.Char('部门')
    company = fields.Char('公司')
    phone = fields.Char('电话')
    email = fields.Char('邮箱')


class EhrDomain(models.Model):
    _name = 'geely.base.ehr.domain'
    _description = '账号后缀'

    name = fields.Char('名称')
    company_id = fields.Many2one('res.company', '对应公司')


class HrEmployeePublic(models.Model):
    _inherit = "hr.employee.public"

    g_login = fields.Char('用户名')
    g_manager_name = fields.Char('主管')  # auto domain
    g_soft_id = fields.Char('工号')
    g_grade = fields.Integer('岗级')
    g_com_name = fields.Char('所属公司')
    g_search = fields.Boolean('Search', compute=lambda self: True, search='search_g_search')
    g_is_supplier = fields.Boolean('是供应商', default=False)
    g_is_to_update = fields.Boolean('是要被更新', default=True)
    g_s_login = fields.Boolean('搜索用户名', compute=lambda self: True, search='search_g_s_login')

class EhrUpdateWizard(models.TransientModel):
    _name = 'geely.ehr.update.wizard'
    _description = '查询/更新员工信息'

    @api.model
    def default_domain_id(self):
        try:
            return self.env.ref('geely_base.data_domain_default').id
        except Exception as e:
            return False
    
    name = fields.Char(default='')
    employee_login = fields.Char('账号')
    domain_id = fields.Many2one('geely.base.ehr.domain', '后缀', default=default_domain_id)
    employee_no = fields.Char('工号')
    employee = fields.Char('姓名')
    result = fields.Char('更新结果')
    company = fields.Selection([
        ('a', '研究总院'),
        ('b', '集团总部')
    ], '公司', help='搜索姓名时按照所属的公司过滤.')
    
    com_name = fields.Char('员工所属公司')
    employee_id = fields.Many2one('hr.employee', '员工')
    department_id = fields.Many2one(related='employee_id.department_id', string='部门', readonly=True)
    job_id = fields.Many2one(related='employee_id.job_id', string='岗位', readonly=True)
    work_email = fields.Char(related='employee_id.work_email', string='邮箱', readonly=True)
    work_phone = fields.Char(related='employee_id.work_phone', string='电话', readonly=True)
    

    def btn_check_employee_login(self):
        if not self.employee_login:
            raise UserError('请先填写账号信息！')
        employee_obj = self.env['hr.employee']
        login = self.employee_login
        if '@' in login:
            raise UserError('账号格式有误！')
        login = '%s@%s' % (login, self.domain_id.name or '')
        res = employee_obj.sudo().update_employee_from_ehr(login, 'login')
        self.update_order_by_employee(res)
        if res.get('employee_id'):
            return 'S'
        else:
            return 'F'
    
    def btn_check_employee_no(self):
        if not self.employee_no:
            raise UserError('请先填写工号！')
        employee_obj = self.env['hr.employee']
        res = employee_obj.sudo().update_employee_from_ehr(self.employee_no, 'empNo')
        self.update_order_by_employee(res)
        if res.get('employee_id'):
            return 'S'
        else:
            return 'F'

    def btn_check_employee_name(self):
        if not self.employee:
            raise UserError('请先填写姓名！')
        if len(self.employee) < 2:
            raise UserError('姓名长度过短，请重新输入！')
        employee_obj = self.env['hr.employee']
        company_dict = {'a': '研究总院', 'b': '集团总部'}
        company_name = self.company and company_dict.get(self.company) or ''
        return employee_obj.sudo().ehr_employee_wizard(self.employee, 'update_order_by_employee', company_name, hide_no=True)

    def update_order_by_employee(self, res):
        employee_id = res.get('employee_id')
        vals = {
            'result': employee_id and '更新成功' or '更新失败',
            'com_name': res.get('com_name') or ''
        }
        if employee_id:
            vals['employee_id'] = employee_id.id
            if self.employee:
                vals['employee'] = employee_id.name
        else:
            vals['employee'] = ''
            vals['employee_id'] = False
        self.write(vals)


class EhrUpdateMultiWizard(models.TransientModel):
    _name = 'geely.ehr.update.multi.wizard'
    _description = '批量更新员工信息'
    
    func = fields.Selection([
        ('employee_no', '工号'),
        ('employee_login', '域账号')
    ], '数据类型', default='employee_no')
    name = fields.Char(default='')
    employee_no = fields.Text('工号')
    employee_login = fields.Text('域账号')
    result = fields.Text('更新结果')
    
    def btn_confirm(self):
        wizard = self.env['geely.ehr.update.wizard'].create({})
        content = self[self.func]
        codes = [code for code in content.split('\n') if code]
        func_dict = {
            'employee_no': ['employee_no', 'btn_check_employee_no'],
            'employee_login': ['employee_login', 'btn_check_employee_login']
        }
        result_list = []
        for code in codes:
            wizard.write({func_dict[self.func][0]: code})
            res = getattr(wizard, func_dict[self.func][1])()
            # res = wizard[func_dict[self.func][1]]()
            s = '%s------%s' % (code, '更新成功' if res == 'S' else '更新失败')
            result_list.append(s)
        self.write({'result': '\n'.join(result_list)})
