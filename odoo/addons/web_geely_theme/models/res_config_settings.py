# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    sidebar_device_size = fields.Selection([
        ('0', '宽>=0px'),
        ('1', '宽>=475px'),
        ('2', '宽>=576px'),
        ('3', '宽>=768px'),
        ('4', '宽>=992px'),
        ('5', '宽>=1200px'),
        ('6', '宽>=1281px'),
        ('7', '宽>=1534px'),
    ], string="设备大小以应用侧边栏菜单", config_parameter='web_geely_theme.sidebar_device_size', default='5')
