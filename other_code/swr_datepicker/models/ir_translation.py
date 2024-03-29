# -*- coding: utf-8 -*-
from odoo import fields, models, api


class IrTranslation(models.Model):
    _inherit = "ir.translation"

    @api.model
    def get_translations_for_webclient(self, mods, lang):
        translations_per_module, lang_params = super(IrTranslation, self).get_translations_for_webclient(mods, lang)

        if lang_params:
            langs = self.env['res.lang']._lang_get(lang)

            lang_params.update({
                'month_format': langs.month_format,
                'year_format': langs.year_format,
            })

        return translations_per_module, lang_params

