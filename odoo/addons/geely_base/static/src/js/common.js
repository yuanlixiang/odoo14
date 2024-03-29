odoo.define('geely_base.base_common', function (require) {
    "use strict";

    const Widget = require('web.Widget');
    const widgetRegistry = require('web.widget_registry');
    const pyUtils = require('web.py_utils');
    const framework = require("web.framework");
    const session = require('web.session');
    const redirect = require('web.framework').redirect;

    const core = require('web.core');
    function logout() {
        redirect('/web/session/logout');
    //    return new Promise(); //这种写法浏览器会出现promise resolver undefined
        return new Promise(function(resolve, reject){});
    }
    core.action_registry.add("logout", logout);


    // 调用lodop打印
    var LodopProviewReport = function (element, action) {
        var LODOP = getLodop();
        if (!LODOP.PRINT_INIT) {
            return;
        }
        eval(action.params.code);
        LODOP.PREVIEW();
    };
    core.action_registry.add("lodop_preview_report", LodopProviewReport);

    // 调用lodop打印
    var LodopPrintReport = function (element, action) {
        var LODOP = getLodop();
        if (!LODOP.PRINT_INIT) {
            return;
        }
        eval(action.params.code);
        LODOP.PRINT();
    };
    core.action_registry.add("lodop_print_report", LodopPrintReport);

       // form视图 x2many字段导出
    var CustomButton = Widget.extend({
        template: 'geely_widgets.CustomButton',
        events: {},
        init: function (parent, record, nodeInfo) {
            this._super.apply(this, arguments);
            this.options = pyUtils.py_eval(nodeInfo.attrs.options || '{}');
            this.record = record;
            this.parent = parent;
            if (this.options.method == 'export_excel_x2m' || this.options.method == 'export_excel_custom') {
                this.options = _.extend(this.options, {
                    'title': '',
                    'class': 'oe_right oe_read_only',
                    'icon': 'fa fa-file-excel-o',
                    'btn_title': '导出 xlsx'
                });
            }
        },
        start: function () {
            this._super.apply(this, arguments);
            var self = this;
            this.$el.click(function () {
                self[self.options.method]();
            });
        },
        export_excel_x2m: function () {
            var self = this;
            var filename = this.options.filename || '';
            var field_name = this.options.field;
            var x2m_field = this.record.data[field_name];
            var x2m_list_data = x2m_field.fieldsInfo.list;
            var x2m_list_fields = x2m_field.fields;
            var model = this.record.model;
            var res_id = this.record.res_id;
            framework.blockUI();
            var export_columns_keys = [];
            var export_columns_names = [];
            for (var key in x2m_list_data){
                export_columns_keys.push(key);
                export_columns_names.push(x2m_list_fields[key].string);
            }
            this.getSession().get_file({
                url: '/web/export/x2m',
                data: {
                    data: JSON.stringify({
                        model: model,
                        active_id: res_id,
                        field: field_name,
                        filename: filename,
                        headers: export_columns_names,
                        fields: export_columns_keys
                    })
                },
                complete: framework.unblockUI
            });
        },
        export_excel_custom: function () {
            framework.blockUI();
            var params = this.options.params || {};
            params.active_id = res_id;
            session.get_file({
                url: '/web/export/g_common',
                data: {
                    data: JSON.stringify({
                        model: this.options.model,
                        method: this.options.export_method || false,
                        params: params
                    })
                },
                complete: framework.unblockUI
            });
        },
    });
    widgetRegistry.add('custom_button', CustomButton);

});