# -*- coding: utf-8 -*-
# @Time : 2021/3/1 13:36
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo.exceptions import UserError
from odoo import api, fields, models, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT as DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT as DATETIME_FORMAT
from datetime import datetime, timedelta
from .gbop_utils import GBOPUtils

import json
import requests
import logging
_logger = logging.getLogger(__name__)


class OperationHistory(models.Model):
    _name = 'geely.operation.history'
    _description = '模型下载记录'
    _order = 'create_date desc'

    login = fields.Char('用户名')
    model = fields.Char('模型')
    download_ids = fields.Text("下载的id")


class OperationAttachmentHistory(models.Model):
    _name = 'geely.operation.attachment.history'
    _description = '附件下载记录'
    _order = 'create_date desc'

    login = fields.Char('用户名')
    model = fields.Char('模型')
    filename = fields.Char('文件名')
    filename_id = fields.Char('文件ID')



class UsersLoginLog(models.Model):
    _name = 'geely.users.login.log'
    _description = '用户登录日志'
    _order = 'create_date desc'

    user_id = fields.Many2one('res.users', '用户')
    operation = fields.Char('操作')
    remote_addr = fields.Char('登录ip')


class UsersAccessLog(models.Model):
    _name = 'geely.users.access.log'
    _description = '用户访问日志'
    _order = 'create_date desc'

    user_id = fields.Many2one('res.users', '用户')
    remote_addr = fields.Char('登录ip')
    actions_id = fields.Many2one('ir.actions.actions', '内容')
    module_id = fields.Many2one('ir.module.module', '模块')
    
    @api.model
    def _cron_bind_module(self, ids=None):
        records = self.search([('module_id', '=', False)])
        module_obj = self.env['ir.module.module']
        model_data_obj = self.env['ir.model.data']
        for record in records:
            try:
                model_data_id = model_data_obj.search([('model', '=', record.actions_id.type), ('res_id', '=', record.actions_id.id)])
                module_id = module_obj.search([('name', '=', model_data_id.module)])
                record.write({'module_id': module_id.id})
            except Exception as e:
                pass

    def get_graph_data(self, method, date_range):
        def get_month_users():
            """返回以月为周期，统计日活跃用户"""
            month_users = date_range['month_users']
            first_date = datetime.strptime(month_users['first_date'], DATE_FORMAT)
            last_date = datetime.strptime(month_users['last_date'], DATE_FORMAT)
            first_date_str = (first_date - relativedelta(hours=8)).strftime(DATETIME_FORMAT)
            last_date_str = '%s %s' % (month_users['last_date'], '15:59:59')
            sql = """
              SELECT 
                COUNT(*) times,
                date
              FROM
              (
                SELECT
                  user_id,
                  to_date(to_char(create_date + interval '8 hour', 'YYYY-MM-DD'), 'YYYY-MM-DD') AS date
                FROM geely_users_access_log
                WHERE create_date BETWEEN '%s' AND '%s'
                GROUP BY user_id, date
              ) mm
              GROUP BY mm.date
              ORDER BY mm.date
            """ % (first_date_str, last_date_str)
            self._cr.execute(sql)
            query_result = self._cr.dictfetchall()

            labels = []
            data = []
            for index in range((last_date - first_date).days + 1):
                date = (first_date + relativedelta(days=index)).date()
                times = 0
                res = list(filter(lambda x: x['date'] == date, query_result))
                if res:
                    times = res[0]['times']

                labels.append(date.strftime('%m-%d'))
                data.append(times)

            return {
                'type': 'bar',
                'data': {
                    'labels': labels,
                    'datasets': [{
                        'data': data,
                        'fill': 'start',
                        'label': '日活跃用户',
                        'backgroundColor': '#1f77b4'
                    }]
                }
            }

        def get_date_module():
            """以天为周期，统计每个模块的访问量"""
            date = date_range['date_module']['date']
            date_start_str = (datetime.strptime(date, DATE_FORMAT) - relativedelta(hours=8)).strftime(DATETIME_FORMAT)
            date_end_str = '%s 15:59:59' % date

            sql = """
                SELECT 
                    mm.date,
                    mm.module_name,
                    COUNT(*) as times
                FROM
                (
                    SELECT
                        al.module_id,
                        al.user_id,
                        im.shortdesc as module_name,
                        to_date(to_char(al.create_date + interval '8 hour', 'YYYY-MM-DD'), 'YYYY-MM-DD') AS date
                    FROM geely_users_access_log al
                    JOIN ir_module_module im ON al.module_id = im.id
                    WHERE al.create_date BETWEEN '%s' AND '%s'
                    GROUP BY al.module_id, al.user_id, im.shortdesc, date
                ) mm
                GROUP BY mm.date, mm.module_name            
            """ % (date_start_str, date_end_str)

            self._cr.execute(sql)
            query_result = self._cr.dictfetchall()

            labels = []
            data = []

            for res in query_result:
                labels.append(res['module_name'])
                data.append(res['times'])

            return {
                'type': 'bar',
                'data': {
                    'labels': labels,
                    'datasets': [{
                        'data': data,
                        'fill': 'start',
                        'label': '日模块访问量',
                        'backgroundColor': '#1f77b4'
                    }]
                }
            }

        def get_month_module():
            """以月为周期，统计每个模块的访问量"""
            month_module = date_range['month_module']
            first_date = datetime.strptime(month_module['first_date'], DATE_FORMAT)

            first_date_str = (first_date - relativedelta(hours=8)).strftime(DATETIME_FORMAT)
            last_date_str = '%s %s' % (month_module['last_date'], '15:59:59')

            sql = """
                SELECT 
                    -- mm.date,
                    mm.module_name,
                    COUNT(*) as times
                FROM
                (
                    SELECT
                        al.module_id,
                        al.user_id,
                        im.shortdesc as module_name,
                        to_date(to_char(al.create_date + interval '8 hour', 'YYYY-MM-DD'), 'YYYY-MM-DD') AS date
                    FROM geely_users_access_log al
                    JOIN ir_module_module im ON al.module_id = im.id
                    WHERE al.create_date BETWEEN '%s' AND '%s'
                    GROUP BY al.module_id, al.user_id, im.shortdesc, date
                ) mm
                GROUP BY mm.module_name            
            """ % (first_date_str, last_date_str)

            self._cr.execute(sql)
            query_result = self._cr.dictfetchall()

            labels = []
            data = []

            for res in query_result:
                labels.append(res['module_name'])
                data.append(res['times'])

            return {
                'type': 'bar',
                'data': {
                    'labels': labels,
                    'datasets': [{
                        'data': data,
                        'fill': 'start',
                        'label': '月模块访问量',
                        'backgroundColor': '#1f77b4'
                    }]
                }
            }

        # 返回所有数据
        if method == 'allData':
            return {
                'month_users': get_month_users(),
                'date_module': get_date_module(),
                'month_module': get_month_module(),
            }

        if method == 'monthUsers':
            return {
                'month_users': get_month_users()
            }

        if method == 'dateModule':
            return {
                'date_module': get_date_module()
            }

        if method == 'monthModule':
            return {
                'month_module': get_month_module()
            }

        return {}
    
    def _cron_push_access_log(self, log_date=None):
        """推送每日访问数据到系统"""
        param_obj = self.env['ir.config_parameter']

        if not log_date:
            # 前一天
            log_date = (datetime.now() - timedelta(days=1)).strftime(DATE_FORMAT)

        log_date1 = datetime.strptime(log_date, DATE_FORMAT) - timedelta(hours=8)
        log_date2 = datetime.strptime(log_date, DATE_FORMAT) + timedelta(hours=16)
        # 获取当天的访问日志 按人员分组
        logs = self.search([('create_date', '>=', log_date1), ('create_date', '<', log_date2)], order='user_id, create_date desc')
        system = param_obj.sudo().get_param('web.base.title')

        res = {
            'dateStr': log_date,
            'system': system,
            'visitSum': 0,  # 访问人数
            'details': []
        }
        details_dict = {}
        for log in logs:
            if log.user_id.id not in details_dict:
                details_dict[log.user_id.id] = {
                    'userId': log.user_id.id,
                    'email': log.user_id.login if '@' in log.user_id.login else log.user_id.login + '@geely.com',
                    'lastVisitTime': (log.create_date + timedelta(hours=8)).strftime(DATETIME_FORMAT),
                    'modules': [log.actions_id.name],
                }
            else:
                details_dict[log.user_id.id]['modules'].append(log.actions_id.name)

        res['details'] = list(details_dict.values())
        res['visitSum'] = str(len(res['details']))

        baseurl = param_obj.get_param('geely_base.visit_log_url')
        gbop_app_access_key = param_obj.get_param('geely_base.gbop_app_access_key')
        gbop_app_secret_key = param_obj.get_param('geely_base.gbop_app_secret_key')

        path = '/monitor/receive'

        gbop = GBOPUtils(host=baseurl, method="POST", path=path, params='',
                         access_key=gbop_app_access_key, secret_key=gbop_app_secret_key)

        response = gbop.get_resp_data(res)
        content = json.dumps(response.text)
        _logger.info(f'访问日志推送结果:{content}')



class ChooseMonthWizard(models.TransientModel):
    _name = 'geely.choose.month.wizard'
    _description = '选择月份向导'

    month = fields.Date('月份')

    def btn_confirm(self):
        """"""
        return {
            'infos': {
                'special': False,
                'month': self.month
            }
        }


class ChooseDateWizard(models.TransientModel):
    _name = 'geely.choose.date.wizard'
    _description = '选择日期向导'

    date = fields.Date('月份')

    def btn_confirm(self):
        """"""
        return {
            'infos': {
                'special': False,
                'date': self.date
            }
        }
