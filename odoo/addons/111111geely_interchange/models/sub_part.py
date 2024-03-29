# -*- coding: utf-8 -*-
from odoo import fields, models
from odoo.http import request

STATE = [('suffice', '满足'), ('dissatisfy', '不满足')]


class Part(models.Model):
    _inherit = 'geely.sda.programme.part'

    # 认证要求
    approve_request_state = fields.Selection(STATE, '认证要求达成状态')
    approve_request_mark = fields.Text('认证要求备注')
    # 法规要求
    statue_request_state = fields.Selection(STATE, '法规要求达成状态')
    statue_request_mark = fields.Text('法规要求备注')
    # 布置要求
    layout_request_state = fields.Selection(STATE, '布置要求达成状态')
    layout_request_mark = fields.Text('布置要求备注')
    # 材料需求
    material_request_state = fields.Selection(STATE, '材料需求达成状态')
    material_request_mark = fields.Text('材料需求备注')
    # 性能需求
    performance_request_state = fields.Selection(STATE, '性能需求达成状态')
    performance_request_mark = fields.Text('性能需求备注')
    # 标识和追溯
    identify_ascend_state = fields.Selection(STATE, '标识和追溯达成状态')
    identify_ascend_mark = fields.Text('标识和追溯备注')
    # 其他要求
    other_request_state = fields.Selection(STATE, '其他要求达成状态')
    other_request_mark = fields.Text('其他要求备注')
    # 接口要求
    interface_request_state = fields.Selection(STATE, '接口要求达成状态')
    interface_request_mark = fields.Text('接口要求备注')
    # 零件参数
    part_parameter_state = fields.Selection(STATE, '零件参数达成状态')
    part_parameter_mark = fields.Text('零件参数备注')
    # 布置要求
    chip_state = fields.Selection(STATE, '芯片达成状态')
    chip_mark = fields.Text('芯片备注')
    # 零件材料
    part_material_state = fields.Selection(STATE, '零件材料达成状态')
    part_material_mark = fields.Text('零件材料备注')
    # 接插件
    sub_electron_state = fields.Selection(STATE, '接插件达成状态')
    sub_electron_mark = fields.Text('接插件备注')

    def jump_to_interchange(self):
        """跳转到技术交流"""
        param_obj = self.env['ir.config_parameter'].sudo()

        website = param_obj.get_param('geely_interchange.website')

        if website.endswith('/'):
            website = website[:-1]

        if hasattr(request.session, 'g_login_checked') and request.session.g_login_checked:
            ticket = request.session.password
            url = '%s/sso?ticket=%s' % (website, ticket)
        else:
            url = website

        return {
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'self'
        }