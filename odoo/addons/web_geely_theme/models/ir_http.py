# -*- coding: utf-8 -*-
from odoo import fields, models


class Http(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        result = super().session_info()
        result["favorite_menu_ids"] = self.env.user.favorite_menu_ids.ids
        result["use_favorite_menu"] = self.env.user.use_favorite_menu
        return result
