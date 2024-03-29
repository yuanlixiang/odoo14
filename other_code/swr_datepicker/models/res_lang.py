# -*- coding: utf-8 -*-
from odoo import fields, models


class Lang(models.Model):
    _inherit = 'res.lang'

    year_format = fields.Char('年份格式')
    month_format = fields.Char('月份格式')
