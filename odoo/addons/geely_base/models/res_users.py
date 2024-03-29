# -*- coding: utf-8 -*-

from odoo import api, fields, models, http, _, tools
from odoo.exceptions import AccessDenied
from odoo.exceptions import UserError
from odoo.http import request
from itertools import chain
from odoo import api, models, registry, SUPERUSER_ID
import json
import logging

_logger = logging.getLogger(__name__)


class CompanyLDAP(models.Model):
    _inherit = 'res.company.ldap'

    email = fields.Char(string='mail', default='mail', help='user email attribute in LDAP')

    def _get_ldap_dicts(self):
        """
        Retrieve res_company_ldap resources from the database in dictionary
        format.
        :return: ldap configurations
        :rtype: list of dictionaries
        """

        ldaps = self.sudo().search([('ldap_server', '!=', False)], order='sequence')
        res = ldaps.read([
            'id',
            'company',
            'ldap_server',
            'ldap_server_port',
            'ldap_binddn',
            'ldap_password',
            'ldap_filter',
            'ldap_base',
            'user',
            'create_user',
            'ldap_tls',
            'email'
        ])
        return res


    def _map_ldap_attributes(self, conf, login, ldap_entry):
        """
        Compose values for a new resource of model res_users,
        based upon the retrieved ldap entry and the LDAP settings.
        :param dict conf: LDAP configuration
        :param login: the new user's login
        :param tuple ldap_entry: single LDAP result (dn, attrs)
        :return: parameters for a new resource of model res_users
        :rtype: dict
        """
        email = ''
        mail = ldap_entry[1]['mail']
        if type(mail) == str:
            email = mail
        elif type(mail) == list:
            email = mail[0]
        return {
            'name': tools.ustr(ldap_entry[1]['cn'][0]),
            'email': email,
            'login': login,
            'company_id': conf['company'][0],
        }
    
    @api.model
    def _get_or_create_user(self, conf, login, ldap_entry):
        login = tools.ustr(login.lower().strip())
        self.env.cr.execute("SELECT id, active FROM res_users WHERE lower(login)=%s", (login,))
        res = self.env.cr.fetchone()
        if res:
            if res[1]:
                return res[0]
        elif conf['create_user']:
            _logger.debug("Creating new Odoo user \"%s\" from LDAP" % login)
            values = self._map_ldap_attributes(conf, login, ldap_entry)
            SudoUser = self.env['res.users'].with_user(2).with_context(no_reset_password=True, ldap_entry=ldap_entry)
            if conf['user']:
                values['active'] = True
                user_id = SudoUser.browse(conf['user'][0]).copy(default=values).id
                request.env.cr.commit()
                return user_id
            else:
                user_id = SudoUser.create(values).id
                request.env.cr.commit()
                return user_id

        raise AccessDenied(_("No local user found for LDAP login and not configured to create one"))

    @api.model
    def g_sso_get_or_create_user(self, info):
        index = 0
        if not info['domainAccountList']:
            login = False
        else:
            login = info['domainAccountList'][0]
            login = login.replace('@geely.com', '').lower()
            if len(info['domainAccountList']) > 1:
                self.env.cr.execute("SELECT id,active FROM res_users WHERE login=%s", (login,))
                res = self.env.cr.fetchone()
                if not res or (res and not res[1]):
                    login = info['domainAccountList'][1]
                    login = login.replace('@geely.com', '')
                    index = 1
        cn = info.get('nickName') or info.get('account') or ' '
        ldap_entry = [login, {
            'cn': [cn],
            'peopleSoftID': info['empNo'],
            'mail': info['domainAccountList'] and info['domainAccountList'][index] or ''
        }]
        return self._get_or_create_user(self._get_ldap_dicts()[0], login, ldap_entry), login


class ResUsers(models.Model):
    _inherit = 'res.users'
    
    g_s_login = fields.Boolean('搜索用户名', compute=lambda self: True, search='search_g_s_login')  # a|b|c

    @api.model
    def search_g_s_login(self, operator, value):
        logins = value.split('|')
        return [('login', 'in', logins)]
    
    @classmethod
    def _login(cls, db, login, password, user_agent_env):
        new_login = login.lower()
        if '@geely.com' in new_login:
            new_login = new_login.replace('@geely.com', '')
        # https://github.com/odoo/odoo/issues/41060
        # 1、使用相同的env, 2、创建用户之后，commit
        # addons/auth_ldap/models/res_users.py
        # 包引入 from odoo.http import request
        # 23行 api.env['res.company.ldap'].sudo()--> request.env['res.company.ldap'].sudo()
        try:
            return super(ResUsers, cls)._login(db, login, password, user_agent_env=user_agent_env)
        except AccessDenied as e:
            Ldap = request.env['res.company.ldap'].sudo()
            for conf in Ldap._get_ldap_dicts():
                entry = Ldap._authenticate(conf, login, password)
                if entry:
                    return Ldap._get_or_create_user(conf, login, entry)
            raise e

    @api.model
    def _check_credentials(self, password, env):
        try:
            if hasattr(request.session, 'g_login_checked') and request.session.g_login_checked:
                return
            else:
                super(ResUsers, self)._check_credentials(password, env)
        except Exception as e:
            super(ResUsers, self)._check_credentials(password, env)
    
    #
    # def g_get_departments(self):
    #     return self.env['hr.department'].sudo().search([('manager_id', '=', self.employee_ids[0].id)]).ids
    

    def g_get_departments(self, user_id=False):
        if not user_id:
            user_id = self._uid
        # self._cr.execute("SELECT id FROM hr_employee WHERE user_id=%s LIMIT 1;" % user_id)
        self._cr.execute("""SELECT h.id FROM hr_employee h
LEFT JOIN resource_resource r ON (h.resource_id=r.id)
WHERE r.user_id = %s AND r.active = TRUE LIMIT 1;""" % user_id)
        res = self._cr.fetchall()
        department_ids = []
        if res:
            employee_id = res[0][0]
            self._cr.execute("SELECT id FROM hr_department WHERE active = TRUE AND manager_id=%s;" % employee_id)
            res = self._cr.fetchall()
            department_ids = [r[0] for r in res]
        return department_ids
    
    @api.model
    def g_clean_rules_cache(self, users, model_name, mode='read'):
        rule_obj = self.env['ir.rule']
        rule_cache = rule_obj.pool.cache
        method = rule_obj._compute_domain.__wrapped__
        for user in users:
            if isinstance(user, int):
                user_id = user
            else:
                user_id = user.id
            try:
                key = ('ir.rule', method, user_id, model_name, mode)
                rule_cache.pop(key)
            except Exception as e:
                pass
    
    @api.model
    def create(self, vals):
        user = super(ResUsers, self).create(vals)

        employee_obj = self.env['hr.employee']
        employee = employee_obj.search([('g_login', '=', user.login)], limit=1)
        employee_work_email = ''
        if employee:
            employee_work_email = employee.work_email
            employee.write({
                'user_id': user.id,
                'address_id': user.partner_id.id,
                'address_home_id': user.partner_id.id
            })
        else:
            employee = employee_obj.create({
                'name': user.name,
                'user_id': user.id,
                'address_id': user.partner_id.id,
                'address_home_id': user.partner_id.id,
                'g_login': user.login
            })
            employee_work_email = employee.work_email
        if employee_work_email and not employee.work_email:
            employee.work_email = employee_work_email
        ldap_entry = self._context.get('ldap_entry')
        if ldap_entry:
            # title
            department_obj = self.env['hr.department']
            job_obj = self.env['hr.job']
            employee_vals = {}
            if not employee.department_id:
                department = ldap_entry[1].get('department')  # 部门
                department_id = False
                if department:
                    if type(department) == list:
                        department_name = department[0].decode('utf-8') if department[0] else ''
                    else:
                        department_name = department if department else ''
                    department_id = department_obj.search([('name', '=', department_name)], limit=1).id
                employee_vals['department_id'] = department_id
            peopleSoftID = ldap_entry[1].get('peopleSoftID')
            if peopleSoftID:
                if type(peopleSoftID) == list:
                    g_soft_id = peopleSoftID[0].decode('utf-8') if peopleSoftID[0] else ''
                else:
                    g_soft_id = peopleSoftID if peopleSoftID else ''
                if g_soft_id not in [0, '0']:
                    employee_vals['g_soft_id'] = g_soft_id
            job = ldap_entry[1].get('title')  # 职位
            if job:
                if type(job) == list:
                    job_name = job[0].decode('utf-8') if job[0] else ''
                else:
                    job_name = job if job else ''
                job_id = job_obj.search([('name', '=', job_name)], limit=1)
                if not job_id:
                    job_id = job_obj.create({'name': job_name})
                employee_vals['job_id'] = job_id.id
            mail = ldap_entry[1].get('mail')
            if mail:
                if type(mail) == list:
                    work_email = mail[0].decode('utf-8') if mail[0] else ''
                else:
                    work_email = mail if mail else ''
                employee_vals['work_email'] = work_email

            employee.write(employee_vals)
            employee.update_employee_from_ehr(user.login, 'login')

        if user.partner_id and employee_work_email:
            user.partner_id.email = employee.work_email

        # 特殊权限：
        # 1 加入供应商组
        if employee.g_is_supplier:
            geely_supplier_group_id = self.env.ref('geely_base.group_geely_supplier')
            geely_supplier_group_id.sudo().g_add_users([user.id])
        # 2 研究总院组
        if employee.g_com_name == '研究总院':
            institute_group_id = self.env.ref('geely_base.group_geely_institute')
            institute_group_id.sudo().g_add_users([user.id])

        return user

    def change_update_work_email_user(self):
        """自动更新，关注者邮箱"""
        for order in self:
            order.partner_id.email = order.employee_ids[0].work_email

    #
    # def write(self, vals):
    #     if 'password' in vals and request.env.user.id != SUPERUSER_ID:
    #         password = vals['password']
    #         if len(password) < 8 or not re.search("^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).*$", password):
    #             raise UserError(_('密码不符合复杂性要求：长度必需大于8位，并且包含大写字母、小写字母、数字和特殊字符'))
    #     return super(ResUsers, self).write(vals)


class ResGroups(models.Model):
    _inherit = 'res.groups'
    

    def g_add_users(self, user_ids):
        if not user_ids:
            return
        for record in self:
            record.write({'users': [(4, user_id) for user_id in user_ids]})
    

    def g_remove_users(self, user_ids):
        if not user_ids:
            return
        self.write({'users': [(3, user_id) for user_id in user_ids]})
