from odoo import models, fields
from datetime import timedelta


class IrSequence(models.Model):
    _inherit = 'ir.sequence'

    def _create_date_range_seq(self, date):
        """修改：支持按天重复"""
        if self._context.get('sequence_repeat') == 'day':
            # 按天重复
            date_from = date
            date_to = date
        else:
            # 默认按年重复
            year = fields.Date.from_string(date).strftime('%Y')
            date_from = '{}-01-01'.format(year)
            date_to = '{}-12-31'.format(year)

            date_range = self.env['ir.sequence.date_range'].search([('sequence_id', '=', self.id), ('date_from', '>=', date), ('date_from', '<=', date_to)], order='date_from desc', limit=1)
            if date_range:
                date_to = date_range.date_from + timedelta(days=-1)
            date_range = self.env['ir.sequence.date_range'].search([('sequence_id', '=', self.id), ('date_to', '>=', date_from), ('date_to', '<=', date)], order='date_to desc', limit=1)
            if date_range:
                date_from = date_range.date_to + timedelta(days=1)

        seq_date_range = self.env['ir.sequence.date_range'].sudo().create({
            'date_from': date_from,
            'date_to': date_to,
            'sequence_id': self.id,
        })
        return seq_date_range