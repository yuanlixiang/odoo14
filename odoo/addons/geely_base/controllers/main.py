# -*- encoding: utf-8 -*-
from odoo import http
from odoo.http import request, content_disposition
from odoo.models import fix_import_export_id_paths
from odoo.addons.web.controllers.main import ExcelExport, CSVExport, Binary
import urllib.parse
import json
import base64
import logging

_logger = logging.getLogger(__name__)


class NewExcelExport(ExcelExport):
    def base(self, data, token):
        res = super(ExcelExport, self).base(data, token)
        params = json.loads(data)
        request.env['geely.operation.history'].sudo().create({
            'model': params.get('model') or '',
            'login': request.env.user.login,
            'download_ids': params.get('ids') or '',
        })
        return res

    def __getattribute__(self, name):
        if name == 'fmt':
            raise AttributeError()
        return super(NewExcelExport, self).__getattribute__(name)

    @http.route('/web/export/x2m', type='http', auth='user')
    def export_x2m(self, data, token):
        """
        用法 form视图中x2m字段下载
        <widget name="custom_button" options="{'method':'export_excel_x2m','field':'line_ids','filename':'功能点检表.xls'}"/>
        """
        data = json.loads(data)
        model = data.get('model')
        active_id = data.get('active_id')
        x2m_field = data.get('field')
        filename = data.get('filename') or self.filename(model)
        columns_headers = data.get('headers', [])
        x2m_fields = data.get('fields', [])
        record = request.env[model].browse(active_id)
        rows = record[x2m_field]._export_rows([fix_import_export_id_paths(f) for f in x2m_fields])
        return request.make_response(
            self.from_data(columns_headers, rows),
            headers=[
                ('Content-Disposition', content_disposition(filename)),
                ('Content-Type', self.content_type),
                ('Content-Language', 'zh-CN'),
            ],
            cookies={'fileToken': token}
        )

    @http.route('/web/export/g_common', type='http', auth='user')
    def g_common(self, data, token):
        data = json.loads(data)
        model = data.get('model')
        method = data.get('method') or 'g_export_common'
        action = getattr(request.env[model], method)
        export_data = action(data)
        return request.make_response(
            export_data['content'],
            headers=[
                ('Content-Disposition', 'attachment; filename="%s"' % export_data['file_name']),
                ('Content-Type', export_data.get('content_type') or self.content_type)
            ],
            cookies={'fileToken': token}
        )

class NewCSVExport(CSVExport):
    def base(self, data, token):
        res = super(CSVExport, self).base(data, token)
        params = json.loads(data)
        request.env['geely.operation.history'].sudo().create({
            'model': params.get('model') or '',
            'login': request.env.user.login,
            'download_ids': params.get('ids') or '',
        })
        return res


class Binary(http.Controller):

    @http.route(['/web/content',
            '/web/content/<string:xmlid>',
            '/web/content/<string:xmlid>/<string:filename>',
            '/web/content/<int:id>',
            '/web/content/<int:id>/<string:filename>',
            '/web/content/<int:id>-<string:unique>',
            '/web/content/<int:id>-<string:unique>/<string:filename>',
            '/web/content/<int:id>-<string:unique>/<path:extra>/<string:filename>',
            '/web/content/<string:model>/<int:id>/<string:field>',
            '/web/content/<string:model>/<int:id>/<string:field>/<string:filename>'], type='http', auth="public")
    def content_common(self, xmlid=None, model='ir.attachment', id=None, field='datas',
                       filename=None, filename_field='name', unique=None, mimetype=None,
                       download=None, data=None, token=None, access_token=None, **kw):
        status, headers, content = request.env['ir.http'].binary_content(
            xmlid=xmlid, model=model, id=id, field=field, unique=unique, filename=filename,
            filename_field=filename_field, download=download, mimetype=mimetype, access_token=access_token)
        if status != 200:
            return request.env['ir.http']._response_by_status(status, headers, content)
        else:
            ir_attachment_id = request.env['ir.attachment'].sudo().search([('id', '=', id)], limit=1)
            if ir_attachment_id.mimetype not in ['application/javascript', 'text/css']:
                request.env['geely.operation.attachment.history'].sudo().create({
                    'login': request.env.user.login,
                    'model': ir_attachment_id.res_model,
                    'filename_id': str(id),
                    'filename': ir_attachment_id.name
                })
            content_base64 = base64.b64decode(content)
            headers.append(('Content-Length', len(content_base64)))
            response = request.make_response(content_base64, headers)
        if token:
            response.set_cookie('fileToken', token)
        return response

