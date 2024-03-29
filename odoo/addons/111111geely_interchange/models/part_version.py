# -*- coding: utf-8 -*-
import json

from odoo import models, api

from ..controllers.main import search_read_fields, get_relational_value


class GeelySdaProgramPartVersion(models.Model):
    _inherit = 'geely.sda.programme.part.version'

    # @api.model
    # def create(self, vals_list):
    #     """计算版本对应的零件数据"""
    #     version = super().create(vals_list)
    # 
    #     # 计算零件数据
    #     part = version.part_id
    #     field_names = search_read_fields(part)
    #     part_datas = part.search_read([('id', 'in', part.ids)], field_names)
    #     for res in part_datas:
    #         for fname in res:
    #             get_relational_value(part, fname, res)
    # 
    #     version.part_datas = json.dumps(part_datas)
    # 
    #     return version



