# -*- coding: utf-8 -*-
import json
import functools
import io
from urllib.parse import quote
import traceback
import logging
import base64
import zipfile

import odoo
from odoo import http
from odoo.api import attrsetter
from odoo.http import Controller, request
from odoo.models import MAGIC_COLUMNS
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT as DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT as DATETIME_FORMAT

_logger = logging.getLogger(__name__)


def serialization_val(val, res, field, fname):
    """序列化日期时间值、字节值"""
    if not val:
        return

    if isinstance(field, (odoo.fields.Binary, odoo.fields.Image)):
        try:
            res[fname] = val.decode('utf-8')
        except UnicodeDecodeError:  # ir.attachment.raw是计算字段，这里解码会发生错误，忽略错误
            res[fname] = False

    elif isinstance(field, (odoo.fields.Datetime, odoo.fields.Date)):
        format_str = DATETIME_FORMAT if isinstance(field, odoo.fields.Datetime) else DATE_FORMAT
        res[fname] = val.strftime(format_str)

    elif isinstance(field, odoo.fields.Many2one):
        comodel_name = field.comodel_name
        if comodel_name == 'ir.attachment':
            datas = request.env['ir.attachment'].sudo().browse(val[0]).datas
            if datas:
                datas = datas.decode('utf-8')

            val = list(val)
            val.append(datas)
            res[fname] = val


def exclude_fields(obj):
    """不同步的字段"""
    exclude_cols = MAGIC_COLUMNS + ['__last_update', 'display_name']
    exclude_cols += list(obj.env['mail.thread']._fields.keys())
    exclude_cols += list(obj.env['mail.activity.mixin']._fields.keys())
    exclude_cols += ['image_1024', 'image_128', 'image_256', 'image_512']  # 仅同步image_1920字段
    exclude_cols = set(exclude_cols)

    return exclude_cols


def search_read_fields(obj):
    """search_read方法的fields字段"""
    # 不同步的字段
    exclude_cols = exclude_fields(obj)

    fields = set(list(obj._fields.keys()))
    fields -= exclude_cols
    fields -= {'parent_path'}
    fields -= {'cost_record_ids'}
    # fields.add('display_name')

    compute_fields = set()  # 计算且不存储的字段
    o2m_self_fields = set()  # 关联到自身的one2many字段
    for fname in obj._fields:
        field = obj._fields[fname]
        if not field.store:
            compute_fields.add(fname)
            continue

        if isinstance(field, odoo.fields.One2many):
            comodel_name = field.comodel_name
            if comodel_name == obj._name:
                o2m_self_fields.add(fname)

    # fields -= compute_fields  # 计算字段也保存
    fields -= o2m_self_fields
    fields = list(fields)

    fields.sort()

    return fields


def get_relational_value(obj, fn, res, base_models=None):
    """序列化bytes和日期时间值，递归计算one2many、many2many字段值"""
    val = res[fn]
    if not val:
        return

    field = obj._fields[fn]

    serialization_val(val, res, field, fn)

    comodel_name = field.comodel_name

    if base_models and comodel_name in base_models:
        return

    if not isinstance(field, (odoo.fields.One2many, odoo.fields.Many2many)):
        return

    if comodel_name.startswith('res.') or comodel_name.startswith('hr.'):
        return

    model_obj = request.env[field.comodel_name].sudo()

    model_res = model_obj.search_read([('id', 'in', val)], search_read_fields(model_obj))

    for _res in model_res:
        for _fn in _res:
            get_relational_value(model_obj, _fn, _res, base_models)

        if field.comodel_name == 'ir.attachment':
            datas = request.env['ir.attachment'].sudo().browse(_res['id']).datas
            _res['datas'] = datas.decode('utf-8')

    res[fn] = model_res


def interface_log(method):
    """接口日志"""
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        log_obj = request.env['geely.sda.api.log'].sudo()

        request_ip = http.request.httprequest.remote_addr
        request_datas = request.httprequest.data

        result = method(self, *args, **kwargs)

        operator, category, url = getattr(method, '_operator')

        state = None

        try:
            res = json.loads(result)
            if res['state'] == 1:
                state = 'success'
            else:
                state = 'failure'
        except:
            pass

        log_obj.create({
            'operator': operator,
            'operator_email': '/',
            'category': category,
            'ip_address': request_ip,
            'request_datas': request_datas,
            'response_datas': result,
            'state': state
        })

        return result

    return wrapper


def set_operator(*args):
    return attrsetter('_operator', args)


def get_part_attachment(part_list):
    """根据零件列表返回attachment"""
    attachment_obj = request.env['ir.attachment'].sudo()
    wizard_obj = request.env['geely.sda.treg.report.wizard'].sudo()
    part_obj = request.env['geely.sda.programme.part'].sudo()

    names = [part.get_treg_name() for part in part_list]

    file_name = '、'.join(names)
    parts_ids = [part.id for part in part_list]
    parts = part_obj.browse(parts_ids)
    wizard = wizard_obj.with_context(part_ids=parts_ids).create({
        'security_class': 'Confidential',
        'issuer_id': 2,
        'name': '、'.join(names),
        'release_state': 'Working',
        'line_ids': parts,
        'issuer_date': odoo.fields.Date.today(),
    })
    try:
        pdf_data = attachment_obj.generate_treg_report('pdf', wizard.id, file_type='pdf')
        # 容错处理
        if not isinstance(pdf_data, dict) or not pdf_data['state']:
            _logger.error('ESOW获取TREG接口，SDA系统生成TR文件出错，返回数据：')
            _logger.error(pdf_data)

            return None, file_name

        # result = io.BytesIO(docx_data)

        attachment = attachment_obj.browse(pdf_data['data']['original_id'])
        # data = io.BytesIO(base64.standard_b64decode(attachment.datas))

        # # 创建版本号
        # operator = 'ESOW'
        # init_version_number = 2
        # for part in parts:
        #     version_obj.create_version(part, operator, init_version_number)
        return attachment, file_name

    except Exception as _:
        _logger.error('ESOW获取TREG接口，SDA生成TR文件失败！')
        _logger.error(traceback.format_exc())


class Interchange(Controller):
    """技术交流平台交互接口，包括与ESOW平台交互接口"""

    @http.route('/geely_odoo/sda_system/treg', type='http', auth="none", csrf=False)
    @interface_log
    @set_operator('ESOW', 'ESOW获取TREG', '/geely_odoo/sda_system/treg')
    def sda_treg(self, **__):
        """
        1、零件号为多个
        2、先验证零件号是否都存在，不存在则返回值
        3、正确则返回TREG的word文件流(暂时为working)
        只能获取publish的零件
        错误情况：
            1、零件号格式不对（根据英文的逗号分隔）
            2、零件号不存在
            3、TREG生成失败，需要联系管理员

        请求参数： {partnos： 零件号1,零件号2,...}
        :return:
        """
        part_obj = request.env['geely.sda.programme.part'].sudo()
        attachment_obj = request.env['ir.attachment'].sudo()

        request_datas = request.httprequest.data

        if not request_datas:
            return json.dumps({
                'resultCode': 0,
                'message': '参数中零件号参数错误',
            }, ensure_ascii=False)

        request_datas = json.loads(request_datas)
        if not request_datas.get('partnos'):
            return json.dumps({
                'resultCode': 0,
                'message': '参数中零件号参数错误',
            }, ensure_ascii=False)

        part_numbers = request_datas['partnos'].split(',')

        # 不存在的零件号
        no_exit = [part_number for part_number in part_numbers if not part_obj.search([('name', '=', part_number)])]

        if no_exit:
            return json.dumps({
                'resultCode': 0,
                'message': '系统未查询到零件号为{}的零件,请去工程方案平台创建该零件TREG数据，再获取文件'.format(','.join(no_exit)),
            }, ensure_ascii=False)

        # # 若零件号找到了，但是方案版本没有publish的，则该零件的方案不传递给ESOW
        # parts = part_obj.search([('name', 'in', part_numbers)]).filtered(lambda r: r.programme_id.programme_state == 'published')
        # 若零件号找到了，但是零件的状态不是publish的，则该零件的方案不传递给ESOW
        parts = part_obj.search([('name', 'in', part_numbers),('project_id', '!=', None)]).filtered(lambda r: r.state == 'publish' and r.treg)
        if not parts:
            return json.dumps({
                'resultCode': 0,
                'message': '工程方案平台中零件不是发布状态或者工程师未上传TR文件',
            }, ensure_ascii=False)

        zip_io = io.BytesIO()
        zf = zipfile.ZipFile(zip_io, 'a')
        for part in parts:
            attachment = attachment_obj.search([('res_model', '=', part._name), ('res_field', '=', 'treg'), ('res_id', '=', part.id)])
            file_name = '%s(%s).%s' % (part.pss_part_name_cn, part.name, part.treg_name.split('.')[-1])

            data = io.BytesIO(base64.standard_b64decode(attachment.datas))
            zf.writestr(file_name, data.getvalue())
        zf.close()

        file_name = '_'.join(list(set(parts.mapped('name'))))
        return http.send_file(zip_io, filename=quote(file_name + 'tr.zip'), as_attachment=True)

        # # 相同技术要求的各自生成一份
        # reference_dict = {}
        # for part in parts:
        #     if part.reference_id:  # 被引用件
        #         if part.reference_id not in reference_dict:
        #             reference_dict[part.reference_id] = [part]
        #         else:
        #             reference_dict[part.reference_id].append(part)
        #     else:
        #         reference_dict[part] = []
        #
        # parts_list = []
        # for k, v in reference_dict.items():
        #     # 每次循环各自生成一份pdf
        #     pl = v
        #     pl.append(k)
        #     parts_list.append(pl)
        #
        # if len(parts_list) == 1:
        #     attachment, file_name = get_part_attachment(parts_list[0])
        #     if not attachment:
        #         return json.dumps({
        #             'resultCode': 0,
        #             'message': '系统生成零件TR文件出错',
        #         }, ensure_ascii=False)
        #     data = io.BytesIO(base64.standard_b64decode(attachment.datas))
        #     return http.send_file(data, filename=quote(file_name + '.pdf'), as_attachment=True)
        #
        # else:
        #     file_name = None
        #     zip_io = io.BytesIO()
        #     zf = zipfile.ZipFile(zip_io, 'a')
        #     for parts in parts_list:
        #         attachment, file_name = get_part_attachment(parts)
        #         if not attachment:
        #             return json.dumps({
        #                 'resultCode': 0,
        #                 'message': '系统生成零件TR文件出错',
        #             }, ensure_ascii=False)
        #         data = io.BytesIO(base64.standard_b64decode(attachment.datas))
        #         zf.writestr(file_name + '.pdf', data.getvalue())
        #     zf.close()
        #     return http.send_file(zip_io, filename=quote(file_name + '.zip'), as_attachment=True)

    @http.route('/geely_odoo/sda_system/part_version', type='http', auth="none", csrf=False)
    @interface_log
    @set_operator('ESOW', 'ESOW获取SDA零件方案版本', '/sda_system/part_version')
    def sda_part_version(self):
        """ESOW获取SDA零件方案版本
        只能获取publish的零件版本
        请求参数： {partnos： 零件号1,零件号2,...}
        :return: {resultCode:1,result:[{'partno':零件号,'version':版本},...]}
        """
        part_obj = request.env['geely.sda.programme.part'].sudo()

        request_datas = request.httprequest.data

        if not request_datas:
            return json.dumps({
                'resultCode': 0,
                'message': '参数中零件号参数错误',
            }, ensure_ascii=False)

        request_datas = json.loads(request_datas)
        if not request_datas.get('partnos'):
            return json.dumps({
                'resultCode': 0,
                'message': '参数中零件号参数错误',
            }, ensure_ascii=False)

        partnos = request_datas['partnos']
        part_numbers = partnos.split(',')

        # 不存在的零件号
        no_exit = [part_number for part_number in part_numbers if not part_obj.search([('name', '=', part_number)])]

        if no_exit:
            return json.dumps({
                'resultCode': 0,
                'message': '系统未查询到零件号为{}的零件'.format(','.join(no_exit)),
            }, ensure_ascii=False)

        parts = part_obj.search([('name', 'in', part_numbers)]).filtered(lambda r: r.state == 'publish')
        if not parts:
            return json.dumps({
                'resultCode': 0,
                'message': '零件不是发布状态',
            }, ensure_ascii=False)

        result = [{'partno': part.name, 'version': part.version} for part in parts]
        return json.dumps({
            'resultCode': 1,
            'result': result
        })

    @http.route('/interchange/sync_base_data', type='http', auth="none", csrf=False, methods=['POST'])
    @interface_log
    @set_operator('技术交流平台', '基础数据同步', '/interchange/sync_base_data')
    def interchange_sync_base_data(self):
        """ 技术交流平台基础数据同步"""
        result = {}
        models = json.loads(request.httprequest.data)
        request.env['ir.config_parameter'].sudo().set_param('geely_interchange.base_models', ','.join(models))

        for model in models:
            model_obj = request.env[model].with_context(active_test=False).sudo()
            fields = model_obj._fields

            model_res = model_obj.search_read([], search_read_fields(model_obj))
            for res in model_res:
                for fn in res:
                    field = fields[fn]
                    val = res[fn]

                    serialization_val(val, res, field, fn)

            result[model] = model_res

        return json.dumps(result)

    @http.route('/interchange/sync_part_data', type='http', auth="none", csrf=False, methods=['POST'])
    @interface_log
    @set_operator('技术交流平台', '零件数据同步', '/interchange/sync_part_data')
    def interchange_sync_part_data(self):
        """ 技术交流平台零件数据同步"""
        def get_relational_value(obj, fn, res):
            """序列化bytes和日期时间值，递归计算one2many、many2many字段值"""
            field = obj._fields[fn]
            val = res[fn]

            serialization_val(val, res, field, fn)

            comodel_name = field.comodel_name

            if not val or not isinstance(field, (odoo.fields.One2many, odoo.fields.Many2many)) or comodel_name in base_models:
                return

            model_obj = request.env[field.comodel_name].sudo()

            model_res = model_obj.search_read([('id', 'in', val)], search_read_fields(model_obj))

            for _res in model_res:
                for _fn in _res:
                    # 忽略零件的方案；项目和车型防止递归
                    if comodel_name == 'geely.sda.programme' and _fn in ['part_ids', 'bom_ids']:
                        continue
                    if comodel_name == 'geely.sda.vehicle.configure' and _fn in ['project_ids']:
                        continue
                    if comodel_name == 'geely.sda.programme.review' or comodel_name == 'geely.part.ce.check' or comodel_name == 'geely.part.ce.cost':
                        continue

                    get_relational_value(model_obj, _fn, _res)

                if field.comodel_name == 'ir.attachment':
                    datas = request.env['ir.attachment'].sudo().browse(_res['id']).datas
                    _res['datas'] = datas.decode('utf-8')

            res[fn] = model_res

        part_obj = request.env['geely.sda.programme.part'].sudo()
        part_history_obj = request.env['geely.sda.programme.part.history'].sudo()

        request_datas = json.loads(request.httprequest.data)
        # part_names = request_datas['part_names']
        # if isinstance(part_names, str):
        #     part_names = part_names.split(',')
        part_infos = request_datas['part_infos']    # [{'part_name': 零件号, 'version': 版本}]
        project_code = request_datas.get('project_code')
        base_models = request_datas['base_models']

        # 保存基础数据模型名称
        request.env['ir.config_parameter'].sudo().set_param('geely_interchange.base_models', ','.join(base_models))

        base_models.append('res.users')
        base_models.append('res.users.role')
        base_models.append('geely.sda.gvps')

        # result = part_obj.search_read([('name', 'in', part_names)], search_read_fields(part_obj))

        results = []
        for part_info in part_infos:
            args = [('name', '=', part_info['part_name'])]
            if part_info.get('version'):
                args += [('version', '=', part_info['part_name'])]

            if project_code:
                args += [('project_id.project_code', '=', project_code)]

            res = part_obj.search_read(args, search_read_fields(part_obj), order='version desc', limit=1)
            # res = part_obj.search_read([('name', '=', part_info['part_name'])], search_read_fields(part_obj))
            if not res:
                # 如果在零件里找不到，则在历史版本中查找
                res = part_history_obj.search_read(args, search_read_fields(part_obj), order='version desc', limit=1)
            results += res
        for result in results:
            # 将零件标记为已进行技术交流
            part_id = result['id']
            part_obj.browse(part_id).interchanged = True

            for fname in result:
                get_relational_value(part_obj, fname, result)
        return json.dumps(results)

    @http.route('/interchange/part_fixed', type='http', auth="none", csrf=False, methods=['POST'])
    @interface_log
    @set_operator('技术交流平台', '零件定点', '/interchange/part_fixed')
    def interchange_part_fixed(self):
        """ 技术交流平台零件定点
        request.httprequest.data数据格式：[{"part_name": "23568963", "value": {field_name: 值, field_name: 值, ...}}, ...]
        """
        # 保存在待处理数据中
        request.env['geely.wait.sync.data'].sudo().create({
            'datas': request.httprequest.data,
            'ttype': 'fixed'
        })
        return 'success'

    @http.route('/interchange/sync_part_cost_compare', type='http', auth="none", csrf=False, methods=['POST'])
    @interface_log
    @set_operator('技术交流平台', '零件数据成本比较数据', '/interchange/sync_part_cost_compare')
    def interchange_sync_part_cost_compare(self):
        """ 零件数据成本比较数据"""
        part_obj = request.env['geely.sda.programme.part'].sudo()
        programme_obj = request.env['geely.sda.programme'].sudo()
        usage_obj = request.env['geely.sda.programme.part.usage'].sudo()

        request_datas = json.loads(request.httprequest.data)
        project_code = request_datas['project_code']
        part_nos = request_datas['part_nos']

        results = []

        parts = part_obj.search([('name', 'in', part_nos)])

        programmes = programme_obj.search([('project_id.name', '=', project_code), ('part_ids', 'in', parts.ids)])

        for programme in programmes:
            result = {
                'project': programme.system_id.project_id.name,
                'programme_code': programme.name,
                'structure_code': programme.structure_id.code,
                'config': ','.join([config.name for config in programme.config_ids]),
                'plan_cost': programme.plan_cost,
                'ce_cost': programme.ce_cost,
                'parts': []
            }
            for part in programme.part_ids:
                usage = usage_obj.search([('programme_id', '=', programme.id), ('part_id', '=', part.id)], limit=1)
                if not usage:
                    qty = 1
                else:
                    qty = usage.usages

                p_dict = {
                    'develop_engineer_email': part.develop_engineer_id.work_email,
                    'part_no': part.name or '',
                    'part_name': part.pss_id.name_cn or '',
                    'gpc_fna': part.pss_id.code,
                    'pmxu': part.pmxu,
                    'send_esow': True if part.purchase_type == 'BUY' else False,
                    'purchase_type': part.purchase_type,
                    'qty': qty,
                    'ce_cost': part.ce_cost
                }
                result['parts'].append(p_dict)

            results.append(result)

        return json.dumps(results)

