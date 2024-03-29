# -*- coding: utf-8 -*-
from odoo import fields, models


class Users(models.Model):
    _inherit = 'res.users'

    favorite_menu_ids = fields.Many2many('ir.ui.menu', string='收藏的菜单')
    use_favorite_menu = fields.Boolean('是否使用收藏菜单功能', default=False)
