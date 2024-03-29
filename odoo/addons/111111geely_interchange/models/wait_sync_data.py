# -*- coding: utf-8 -*-
import requests
import traceback
import json
import logging

from odoo import fields, models, api
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class WaitSyncData(models.Model):
    _name = 'geely.wait.sync.data'
    _description = '待处理数据'
    _order = 'id desc'

    model_id = fields.Many2one('ir.model', '模型名称', compute='_compute_model_id', store=1)
    model = fields.Char('模型')
    datas = fields.Text('数据')
    ttype = fields.Selection([('base_increment', '基础数据增量'), ('fixed', '定点数据')], '数据类型', default='base_increment')
    state = fields.Selection([('draft', '待处理'), ('done', '处理成功'), ('fail', '处理失败')], '状态', default='draft')
    sync_date = fields.Datetime('处理时间')
    error = fields.Text('异常信息')
    error_count = fields.Integer('错误次数')

    @api.depends('model')
    def _compute_model_id(self):
        model_obj = self.env['ir.model']

        for res in self:
            model_id = False
            if res.model:
                model = model_obj.search([('model', '=', res.model)])
                model_id = model.id

            res.model_id = model_id

    def action_sync_base_data(self):
        """推送基出数据增量"""
        url = self._get_sync_url()

        self._sync_base_data(url)

    def _cron_sync_base_data(self):
        """推送增量基础数据"""
        url = self._get_sync_url()

        for res in self.search([('ttype', '=', 'base_increment'), ('state', '!=', 'done')], order='id asc'):
            res._sync_base_data(url)

    def _sync_base_data(self, url):
        datas = self.datas
        state = 'done'
        error = False
        try:
            response = requests.post(url, data=datas)

            status_code = response.status_code
            if status_code != 200:
                raise Exception('调用接口发生错误，响应码：%s' % (status_code,))
        except Exception as _:
            state = 'fail'
            error = traceback.format_exc()

        self.write({
            'state': state,
            'error': error,
            'sync_date': fields.Datetime.now()
        })
        self._cr.commit()

    def _get_sync_url(self):
        param_obj = self.env['ir.config_parameter'].sudo()

        website = param_obj.get_param('geely_interchange.website')
        base_data_url = param_obj.get_param('geely_interchange.base_data_url')
        if not base_data_url or not website:
            raise ValidationError('系统没有配置技术交流平台的地址或基出数据增量接口地址，请联系管理员！')

        if website.endswith('/'):
            website = website[0:-1]

        if not base_data_url.startswith('/'):
            base_data_url = '/' + base_data_url

        return '%s%s' % (website, base_data_url)

    def process_part_fixed_data(self):
        """处理零件定点数据"""
        def build_base_value():
            """基本字段类型值"""
            attachment_ids = [(5,)]
            bomb_attachment_ids = [(5,)]
            for attach_val in value['attachment_ids']:
                attach = attachment_obj.create({
                    'res_model': attach_val['res_model'],
                    'name': attach_val['res_model'],
                    'datas': attach_val['datas'],
                    'mimetype': attach_val['mimetype'],
                    'type': attach_val['type']
                })
                attachment_ids.append((4, attach.id))

            for attach_val in value['bomb_attachment_ids']:
                attach = attachment_obj.create({
                    'res_model': attach_val['res_model'],
                    'name': attach_val['res_model'],
                    'datas': attach_val['datas'],
                    'mimetype': attach_val['mimetype'],
                    'type': attach_val['type']
                })
                bomb_attachment_ids.append((4, attach.id))

            return {
                'part_supplier_name': value['supplier_name'],
                'part_supplier_code': value['supplier_code'],
                'test_plan_start_date': value['test_plan_start_date'],
                'test_plan_end_date': value['test_plan_end_date'],
                'attachment_ids': attachment_ids,
                'bomb_attachment_ids': bomb_attachment_ids,
                'ce_cost': value['ce_cost'],
                'seller_pmxu': value['seller_pmxu'],
                'fixed_point_time': value['fixed_point_time'],
            }

        def build_part_parameter_value():
            """计算零件参数值"""
            def get_val():
                return {
                    'approve_description': row['approve_description'],  # 认可说明
                    'approve_type': row['approve_type'],  # 认可形式
                    # 'attachment_ids': [],  # 文件(可能废弃)
                    'end_date': row['end_date'],  # 计划结束时间
                    # 'has_children': row['has_children'],  # 是否有子参数(可能废弃)
                    'is_diff_execute': row['is_diff_execute'],  # 试验优化是否差异执行
                    'is_split': row['is_split'],  # 是否拆解
                    # 'is_test': row['is_test'],  # 是否涉及试验(可能废弃)
                    'mark': row['mark'],  # 备注
                    'note': row['note'],  # 参数描述
                    'parameter_id': row['parameter_id'],  # 详细参数
                    'parameter_value': row['parameter_value'],  # 参数值
                    # 'parent_id': row['parent_id'],  # 上级
                    # 'part_id': row['part_id'],  # 零件
                    # 'programme_id': row['programme_id'],  # 方案(无法确定方案)(可能废弃)
                    'sample_quantity': row['sample_quantity'],  # 样品数量
                    'special_character': row['special_character'],  # 特殊特性等级标识
                    'start_date': row['start_date'],  # 计划开始时间
                    'state_ids': [(6, 0, row['state_ids'])],  # 样件状态
                    # 'state_name': row['state_name'],  # 样件状态名称(计算字段)
                    'target_req': row['target_req'],  # 目标要求（评定依据）
                    'test_cate_ids': [(6, 0, [v['origin_id'] for v in row['test_cate_ids']])],  # 试验类型
                    'test_location': row['test_location'],  # 试验地点
                    # 'test_name': row['test_name'],  # 废弃
                    'test_name_dvpv': row['test_name_dvpv'],  # 试验名称
                    'test_period': row['test_period'],  # 试验周期(天)
                    'test_spec': row['test_spec'],  # 标准号及名称
                    'unit_id': row['unit_id'],  # 单位
                }

            rows = value['part_parameter_ids']

            part_parameter_vals = []

            # 新增的记录
            for row in list(filter(lambda x: not x['origin_id'], rows)):
                part_parameter_vals.append((0, 0, get_val()))

            # 保持的记录
            for row in list(filter(lambda x: x['origin_id'], rows)):
                origin_id = row['origin_id']
                part_parameter = part_parameter_obj.search([('id', '=', origin_id)])
                if not part_parameter:
                    part_parameter_vals.append((0, 0, get_val()))
                else:
                    part_parameter_vals.append((1, row['origin_id'], get_val()))

            # 减少的
            ids = set([row['origin_id'] for row in rows if row['origin_id']])  # 现有的记录ids
            old_ids = set(part.part_parameter_ids.ids)  # 原来的记录ids
            for part_parameter_id in list(old_ids - ids):
                part_parameter_vals.append((2, part_parameter_id))

            return part_parameter_vals

        def build_bom_value():
            """计算bom_ids字段值"""
            def get_bom_level(name):
                if not name:
                    return False

                return level_obj.search([('name', '=', name)]).id

            def get_val():
                attachment_ids = [(5,)]
                for attach_val in row['attachment_ids']:
                    attach = attachment_obj.create({
                        'res_model': attach_val['res_model'],
                        'name': attach_val['res_model'],
                        'datas': attach_val['datas'],
                        'mimetype': attach_val['mimetype'],
                        'type': attach_val['type']
                    })
                    attachment_ids.append((4, attach.id))

                return {
                    'all_cycle_sales': row['all_cycle_sales'],  # 全生命周期销量（万）
                    'alternative_chip': row['alternative_chip'],  # 备选芯片(按需)(可能不需要)
                    'appearance': row['appearance'],  # 是否外观件
                    'approve_type': row['approve_type'],  # 原材料认可类型
                    'assembling_process': row['assembling_process'],  # 装配工艺
                    'attachment_ids': attachment_ids,  # 图片
                    'buy_manufacturer': row['buy_manufacturer'],  # 外购件制造商
                    'buy_or_make': row['buy_or_make'],  # 外购自制
                    'buy_origin': row['buy_origin'],  # 外购件是否进口
                    'carbon_emission': row['carbon_emission'],  # 碳排放量
                    'chip_id': row['chip_id'],  # 芯片
                    # 'chip_spec': row['chip_spec'],  # 规格型号(关联字段)
                    # 'chip_supplier': row['chip_supplier'],  # 供应商(关联字段)
                    'collect': row['collect'],  # 直采
                    'color_code': row['color_code'],  # 颜色/纹理代码
                    'corrosion_resistance': row['corrosion_resistance'],  # 耐腐蚀时间要求/h
                    'device_type': row['device_type'],  # 设备型号
                    'double_welding_length': row['double_welding_length'],  # 二保焊长度
                    'fixture_qty': row['fixture_qty'],  # 夹具数量
                    'glue_length': row['glue_length'],  # 涂胶长度
                    'glue_type': row['glue_type'],  # 涂胶类型
                    'identifier': row['identifier'],  # 标识
                    'inspection_tool_qty': row['inspection_tool_qty'],  # 检具数量
                    # 'is_collect': row['is_collect'],  # 是否已采集(废弃)
                    # 'last_tracking_id': row['last_tracking_id'],  # 最近一镒推送eps，保存的字段跟踪(mail.tracking.value)id(不用存储)
                    'level': row['level'],  # 层数
                    'level_id': get_bom_level(row['level_id']),  # 层级
                    'manufacture_device': row['manufacture_device'],  # 生产设备
                    'manufacture_process': row['manufacture_process'],  # 制造工艺
                    'material_category_id': row['material_category_id'],  # 材料类型
                    # 'material_id': row['material_id'],  # 材料标识/牌号(可能废弃)
                    'mold_qty': row['mold_qty'],  # 模具数量
                    'name': row['name'],  # 零件名称
                    'note': row['note'],  # 备注
                    'parent_identifier': row['parent_identifier'],  # 父项标识
                    'parent_level_id': get_bom_level(row['parent_level_id']),  # 界面用
                    # 'part_id': row['part_id'],  # 零件(不保存)
                    'part_no': row['part_no'],  # 零件号
                    'part_size_h': row['part_size_h'],  # 零件尺寸(高)
                    'part_size_l': row['part_size_l'],  # 零件尺寸(长)
                    'part_size_t': row['part_size_t'],  # 零件尺寸(厚度)
                    'part_size_w': row['part_size_w'],  # 零件尺寸(宽)
                    'part_type': row['part_type'],  # 零件类型
                    'pmxu': row['pmxu'],  # 供应商子零件PMXU
                    'qty': row['qty'],  # 数量
                    'raw_material_manufacturer': row['raw_material_manufacturer'],  # 原材料制造商
                    'recipe_number': row['recipe_number'],  # 非金属材料牌号
                    # 'sequence': row['sequence'],  # 序号(不保存)
                    'sub_supplier_city': row['sub_supplier_city'],  # 子件供应商生产地城市
                    # 'summary': row['summary'],  # (不保存)
                    'surface_treatment_area': row['surface_treatment_area'],  # 表面处理面积(㎡)
                    'surface_treatment_process': row['surface_treatment_process'],  # 供应商子件表面处理工艺
                    'surface_treatment_supplier': row['surface_treatment_supplier'],  # 表面处理供应商
                    'unit_id': row['unit_id'],  # 单位
                    'unit_weight': row['unit_weight'],  # 重量(g)
                    'vehicle': row['vehicle'],  # 吉利在用车型
                    # 'vehicle_id': row['vehicle_id'],  # 吉利在用车型(可能废弃)
                    'welding_point_qty': row['welding_point_qty'],  # 焊点数量
                    'welding_qty': row['welding_qty'],  # 凸焊数量
                }

            rows = value['bom_ids']

            bom_ids = []

            # 新增的记录
            for row in list(filter(lambda x: not x['origin_id'], rows)):
                bom_ids.append((0, 0, get_val()))

            # 保持的记录
            for row in list(filter(lambda x: x['origin_id'], rows)):
                origin_id = row['origin_id']
                bom = bom_obj.search([('id', '=', origin_id)])
                if not bom:
                    bom_ids.append((0, 0, get_val()))
                else:
                    bom_ids.append((1, row['origin_id'], get_val()))

            # 减少的
            ids = set([row['origin_id'] for row in rows if row['origin_id']])  # 现有的记录ids
            old_ids = set(part.bom_ids.ids)  # 原来的记录ids
            for bom_id in list(old_ids - ids):
                bom_ids.append((2, bom_id))

            return bom_ids

        attachment_obj = self.env['ir.attachment']
        part_obj = self.env['geely.sda.programme.part']
        version_obj = self.env['geely.sda.programme.part.version']
        part_parameter_obj = self.env['geely.sda.programme.part.parameter']
        bom_obj = self.env['geely.part.bom']
        level_obj = self.env['geely.part.level']

        operator = '技术交流平台'
        init_version_number = 3

        state = 'done'
        error = False
        error_count = self.error_count
        if error_count >= 5:
            return

        try:
            datas = json.loads(self.datas)
            for fixed_part in datas:
                part_name = fixed_part['part_name']
                part = part_obj.search([('name', '=', part_name)])
                if not part:
                    raise ValidationError('没有找到零件号：%s 对应的零件！' % part_name)

                # 版本跟踪，在修改零件数据出错时，回退到当前
                version_obj.create_version(part, operator, init_version_number)

                value = fixed_part['value']  # 技术交流平台传递过来的数据

                # 基本字段类型值
                vals = build_base_value()

                # 零件参数
                vals['part_parameter_ids'] = build_part_parameter_value()

                # 零件BOM
                vals['bom_ids'] = build_bom_value()

                # 修改零件数据
                part.write(vals)

                # 零件释放
                part.action_release()
        except:
            state = 'fail'
            error = traceback.format_exc()
            _logger.error('处理定点数据出错：')
            _logger.error(error)
            error_count += 1

        self.write({
            'state': state,
            'error': error,
            'sync_date': fields.Datetime.now(),
            'error_count': error_count
        })

        self._cr.commit()

    def _cron_process_part_fixed_data(self):
        """处理零件定点数据
        零件定点数据格式：[{"part_name": "23568963", "value": {field_name: 值, field_name: 值, ...}}, ...]
        """
        for res in self.search([('ttype', '=', 'fixed'), ('state', '!=', 'done')]):
            res.process_part_fixed_data()





