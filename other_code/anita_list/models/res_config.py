# -*- coding: utf-8 -*-

from odoo import api, fields, models


class AnitaTableSetting(models.TransientModel):
    '''
    awesome user setting
    '''
    _inherit = 'res.config.settings'

    virtual_scroll = fields.Boolean(string="Virtual Scroll", default=True)
    allow_user_config = fields.Boolean(string="Allow User Config", default=True)


    @api.model
    def get_values(self):
        '''
        get the vuales
        :return:
        '''
        res = super(AnitaTableSetting, self).get_values()
        config = self.env['ir.config_parameter'].sudo()

        virtual_scroll = config.get_param('anita_list.virtual_scroll')
        allow_user_config = config.get_param('anita_list.allow_user_config')

        # get the favicon
        res.update({
            'virtual_scroll': virtual_scroll,
            'allow_user_config': allow_user_config
        })

        return res

    def set_values(self):
        '''
        set values
        :return:
        '''
        super(AnitaTableSetting, self).set_values()

        ir_config = self.env['ir.config_parameter'].sudo()

        ir_config.set_param("anita_list.virtual_scroll", self.virtual_scroll)
        ir_config.set_param("anita_list.allow_user_config", self.allow_user_config)

