# -*- coding: utf-8 -*-
from odoo import models
from odoo.exceptions import AccessError


class Message(models.Model):
    _inherit = 'mail.message'

    def check_access_rule(self, operation):
        """系统管理员在读取mail.message不验证rule"""
        try:
            super(Message, self).check_access_rule(operation)
        except AccessError:
            if operation == 'read' and self.env.user.has_group('base.group_system'):
                return

            raise

