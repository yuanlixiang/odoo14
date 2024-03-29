# -*- coding: utf-8 -*-
import functools
import json

from odoo import models, api

from ..controllers.main import serialization_val, search_read_fields

# 软删除的基础数据模型
group_unlink = ['geely.sda.parameter', 'geely.sda.property.category', 'geely.sda.property.template']


def create_sync_data(self, method, vals):
    """创建同步数据"""
    self.env['geely.wait.sync.data'].create({
        'model': self._name,
        'datas': json.dumps({
            'model': self._name,
            'method': method,
            'vals': vals,
        })
    })


def sync_data(method):
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):

        base_models = self.env['ir.config_parameter'].sudo().get_param('geely_interchange.base_models', '')  # 要同步的基出数据模型
        base_models = base_models.split(',')

        if self._name not in base_models:
            return method(self, *args, **kwargs)

        method_name = method.__name__

        if method_name == 'unlink':
            if self._name not in group_unlink:  # 非软删除，软删除到write方法中处理
                create_sync_data(self, method_name, self.ids)

            return method(self, *args, **kwargs)

        result = method(self, *args, **kwargs)

        if method_name == 'create':
            ids = result.ids
        else:
            ids = self.ids

        fields = self._fields
        model_res = self.with_context(active_test=False).search_read([('id', 'in', ids)], search_read_fields(self))

        for res in model_res:
            for fn in res:
                field = fields[fn]
                val = res[fn]

                serialization_val(val, res, field, fn)

        create_sync_data(self, method_name, model_res)

        return result

    return wrapper


class Base(models.AbstractModel):
    """geely_interchange.base_models配置的基础数据模型的增删改，同步到技术交流平台"""
    _inherit = 'base'

    @sync_data
    @api.model
    def create(self, vals_list):
        return super().create(vals_list)

    @sync_data
    def write(self, vals):
        return super().write(vals)

    @sync_data
    def unlink(self):
        return super().unlink()







