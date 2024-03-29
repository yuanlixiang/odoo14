# -*- coding: utf-8 -*-
import os

import odoo
from odoo import api, fields, models
from odoo.addons.geely_base.models.exceptions import UploadExtError


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    category_id = fields.Many2many('ir.attachment.category', string='标签')

    @api.onchange('datas_fname')
    def onchange_datas_file(self):
        if self.datas_fname:
            self.name = self.datas_fname

    @api.constrains('name')
    def _check_file_ext(self):
        """在修改附件内容时，校验上传文件类型。在通过/web/binary/upload_attachment上传时不校验"""
        # 禁止的文件扩展名，系统参数prohibit_exts，以英文逗号分隔
        prohibit_exts = self.env['ir.config_parameter'].sudo().get_param('prohibit_exts', 'js.php,pl,cgi,asp,aspx,jsp,php5,php4,php3,htm,html,exe')
        prohibit_exts = prohibit_exts.split(',')
        prohibit_exts = map(lambda x: x.strip(), prohibit_exts)

        for attachment in self:
            if not attachment.name:
                continue

            _, ext = os.path.splitext(attachment.name)
            if not ext:
                continue

            if ext.startswith('.'):
                ext = ext[1:]

            if ext in prohibit_exts:
                raise UploadExtError('%s为禁止上传的文件类型' % ext)

        return True


class IrAttachmentCategory(models.Model):
    _name = 'ir.attachment.category'
    _description = '附件目录'

    name = fields.Char('名称')
    g_apply_categ = fields.Char('应用于')
