odoo.define('geely_widgets.form_widgets', function (require) {
    "use strict";

    var core = require('web.core');
    var data = require('web.data');
    var form_widgets = require('web.form_widgets');
    var ListView = require('web.ListView');
    var FormView = require('web.FormView');
    var session = require('web.session');
    var form_common = require('web.form_common');
    var form_relational = require('web.form_relational');
    var utils = require('web.utils');
    var Widget = require('web.Widget');
    var search_filters = require('web.search_filters');
    var pyeval = require('web.pyeval');
    var Datepicker = require('web.datepicker');
    var WebClient = require('web.WebClient');
    var Model = require('web.DataModel');
    var formats = require('web.formats');
    var Dialog = require('web.Dialog');
    var WebView = require('web.View');
    var WebEditor = require('web_editor.backend');

    var FieldBinaryImage = core.form_widget_registry.get('image');
    var FieldTextHtmlSimple = WebEditor.FieldTextHtmlSimple;
    var ColumnBinary = core.list_widget_registry.get('field.binary');
    var ColumnChar = core.list_widget_registry.get('field.char');
    var FieldMany2One = form_relational.FieldMany2One;
    var FieldMany2ManyTags = form_relational.FieldMany2ManyTags;
    var FieldChar = form_widgets.FieldChar;
    var FieldFloat = form_widgets.FieldFloat;
    var One2ManyListView = core.one2many_view_registry.get('list');
    var list_widget_registry = core.list_widget_registry;

    var _t = core._t;
    var QWeb = core.qweb;


    FieldBinaryImage.include({
        render_value: function () {
            this._super.apply(this, arguments);
            if (this.options.swipebox) {
                var $img = this.$('> img');
                var href = $img.attr('src');
                if (this.options.swipebox_image && this.options.swipebox_small && href.indexOf(this.options.swipebox_small) > -1) {
                    href = href.replace(this.options.swipebox_small, this.options.swipebox_image);
                }
                $img.click(function (e) {
                    e.preventDefault();
                    $.swipebox([
                        {href: href, title: ''},
                    ]);
                });
            }
        },
    });

    ColumnBinary.include({
        _format: function (row_data, options) {
            var res = this._super.apply(this, arguments);
            if (this.swipebox) {
                var value = row_data[this.id].value;
                if (value && value.substr(0, 10).indexOf(' ') != -1) {
                    var href, filename = '文件';
                    href = session.url('/web/content', {model: options.model, field: this.id, id: options.id});
                    if (this.filename) {
                        href += '&filename_field=' + this.filename;
                    }
                    if (this.filename && row_data[this.filename]) {
                        filename = row_data[this.filename].value;
                    }
                    res = res + _.template('<a class="list_binary_swipebox" href="<%-href%>" data-filename="<%-filename%>">' + _t('预览') + '</a>')({
                        href: href,
                        filename: filename,
                    });
                }
            }
            return res;
        }
    });

    var GFieldHtmlLink = FieldTextHtmlSimple.extend({
        _config: function () {
            var self = this;
            this.$el.addClass('g_html_link');
            var config = {
                'focus': false,
                'height': 180,
                'width': 225,
                'toolbar': [
                    ['font', ['bold', 'italic', 'underline', 'clear']],
                    ['fontsize', ['fontsize']],
                    ['color', ['color']],
                    ['insert', ['link']],
                ],
                'prettifyHtml': false,
                'styleWithSpan': false,
                'inlinemedia': ['p'],
                'lang': "odoo",
                'onChange': function (value) {
                    self.internal_set_value(value);
                    self.trigger('changed_value');
                }
            };
            if (session.debug) {
                config.toolbar.splice(7, 0, ['view', ['codeview']]);
            }
            return config;
        },
    });

    core.form_widget_registry.add('g_html_link', GFieldHtmlLink);

    WebView.include({
        is_action_enabled: function(action) {
            var context = this.dataset.context;
            if (action=='create' && (context.no_create || context.view_readonly)){
                return false;
            } else if (action=='edit' && (context.no_edit || context.view_readonly)) {
                return false;
            }
            return this._super.apply(this, arguments);
        },
    });

    ListView.List.include({
        init: function (group, opts) {
            this._super.apply(this, arguments);
            this.$current.delegate('a.list_binary_swipebox', 'click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var $target = $(e.currentTarget);
                // var $a = $target.prevAll('a:not(.list_binary_swipebox)');
                $.swipebox([
                    {href: $target.attr('href') + '#swipeboxvideo=1', title: $target.attr('data-filename')},
                ]);
            });
        },
    });
    ListView.include({
        init: function () {
            this._super.apply(this, arguments);
            if (this.fields_view.arch.attrs.force_import_enabled) {
                this.options.force_import_enabled = true;
            }
            if (this.fields_view.arch.attrs.force_import_unabled) {
                this.options.import_enabled = false;
            }
            this.options.import_template_download = this.fields_view.arch.attrs.import_template_download;
            this.options.import_template_download_filename = this.fields_view.arch.attrs.import_template_download_filename;
        },
        start_edition: function (record, options) {
            var self = this;
            var item = false;
            if (record) {
                item = record.attributes;
                this.dataset.select_id(record.get('id'));
            } else {
                record = this.make_empty_record(false);
                this.records.add(record, {at: (this.prepends_on_create()) ? 0 : null});
            }

            return this.save_edition().then(function () {
                return $.when.apply($, self.editor.form.render_value_defs);
            }).then(function () {
                var $recordRow = self.groups.get_row_for(record);
                var cells = self.get_cells_for($recordRow);
                var fields = {};
                self.fields_for_resize.splice(0, self.fields_for_resize.length); // Empty array
                return self.with_event('edit', {
                    record: record.attributes,
                    cancel: false,
                }, function () {
                    return self.editor.edit(item, function (field_name, field) {
                        var cell = cells[field_name];
                        if (!cell) {
                            return;
                        }

                        // FIXME: need better way to get the field back from bubbling (delegated) DOM events somehow
                        field.$el.attr('data-fieldname', field_name);
                        fields[field_name] = field;
                        self.fields_for_resize.push({field: field, cell: cell});
                    }, options).then(function () {
                        $recordRow.addClass('o_row_edition');
                        self.resize_fields();
                        // Local function that returns true if field is visible and editable
                        var is_focusable = function (field) {
                            return field && field.$el.is(':visible:not(.o_readonly)');
                        };
                        var focus_field = options && options.focus_field ? options.focus_field : undefined;
                        if (!is_focusable(fields[focus_field])) {
                            focus_field = _.find(self.editor.form.fields_order, function (field) {
                                return is_focusable(fields[field]);
                            });
                        }
                        if (fields[focus_field]) {
                            fields[focus_field].$el.find('input, textarea').andSelf().filter('input, textarea').select();
                            var $checkbox = fields[focus_field].$checkbox;
                            if ($checkbox) {
                                var field_value = fields[focus_field].get('value');
                                $checkbox.prop('checked', !field_value);
                                fields[focus_field].internal_set_value(!field_value);
                            }
                        }
                        return record.attributes;
                    });
                }).fail(function () {
                    // if the start_edition event is cancelled and it was a creation, remove the newly-created empty record
                    if (!record.get('id')) {
                        self.records.remove(record);
                    }
                });
            }, function () {
                return $.Deferred().resolve(); // Here the save/cancel edition failed so the start_edition is considered as done and succeeded
            });
        },
        do_add_record: function () {
            var context = this.dataset.context;
            var create_with_wizard = context.create_with_wizard;
            if (!create_with_wizard) {
                return this._super.apply(this, arguments);
            } else {
                this.do_action({
                    name: context.create_wizard_title || '创建向导',
                    type: 'ir.actions.act_window',
                    res_model: context.create_wizard_model,
                    views: [[false, 'form']],
                    target: 'new',
                });
            }
        },
        render_buttons: function ($node) {
            var no_render = !this.$buttons;
            this._super.apply(this, arguments);
            if (no_render && this.$buttons) {
                this.$buttons.find('.o_list_button_custom').click(this.proxy('do_custom_button_action'));
            }
        },
        do_custom_button_action: function (e) {
            var context = this.dataset.context;
            var data_id = $(e.currentTarget).attr('data-id');
            var button_action = context.list_custom_buttons[data_id].action;
            if (button_action.need_active_ids) {
                var active_ids = this.get_selected_ids();
                if (button_action.need_active_ids_check && active_ids.length==0) {
                    new Dialog(this, {title: _t("Warning"), size: 'medium', $content: $("<div/>").html(_t("You must choose at least one record."))}).open();
                    return false;
                }
                button_action.context = button_action.context || {};
                button_action.context['active_ids'] = active_ids;
            }
            this.do_action(button_action);
        }
    });


    WebClient.include({
        show_application: function() {
            var res = this._super.apply(this, arguments);
            this.menu.on('menu_click', this, this.g_menu_action);
            return res;
        },
        g_menu_action: function (options) {
            var self = this;
            if (options.action_id) {
                self.rpc("/web/geely/access/log", {action_id: options.action_id}).done(function (result) {
                });
            }
        }
    });

    var GeelyActionNotify = function (element, action) {
        element.do_notify(action.params.title, action.params.text, action.params.sticky);
    };

    core.action_registry.add("geely_action_notify", GeelyActionNotify);

    var GeelyActionNotifyReload = function (element, action) {
        element.do_notify(action.params.title, action.params.text, action.params.sticky);
        return {'type': 'ir_actions_act_window_close'};
    };

    core.action_registry.add("geely_action_notify_reload", GeelyActionNotifyReload);

    var GeelyKanbanNotifyRefresh = function (element, action) {
        element.do_notify(action.params.title, action.params.text, action.params.sticky);
        core.bus.trigger('g_kanban_js_refresh');
    };

    core.action_registry.add("geely_kanban_notify_refresh", GeelyKanbanNotifyRefresh);

    var GeelyActionNotifyAction = function (element, action) {
        element.do_notify(action.params.title, action.params.text, action.params.sticky);
        return element.do_action(action.params.action);
    };
    core.action_registry.add("geely_action_notify_action", GeelyActionNotifyAction);

    FieldMany2One.include({
        initialize_field: function () {
            this.is_started = true;
            core.bus.on('click', this, function () {
                if (!this.get("effective_readonly") && this.$input && this.$input.autocomplete() && this.$input.autocomplete('widget').is(':visible')) {
                    this.$input.autocomplete("close");
                }
            });
            form_common.ReinitializeFieldMixin.initialize_field.call(this);
        },
    });

    FieldChar.include({
        start: function () {
            this._super.apply(this, arguments);
            if (this.node.attrs.auto_select) {
                var $input = this.$el.find('input, textarea').andSelf().filter('input, textarea');
                $input.focus(function () {
                    this.select();
                });
            }
        },
        format_value: function(val, def) {
            if (val===0 && this.options.hide_zero) {return '';}
            return this._super(val, def);
        },
    });

    var FieldColor = FieldChar.extend({
        'template': 'FieldColor',
        render_value: function () {
            this._super.apply(this, arguments);
            if (!this.$('input').data('minicolors-settings')) {
                this.$('input').val(this.get_value() || '');
            } else {
                this.$('input').minicolors('value', this.get_value() || '');
            }
        },
        initialize_content: function() {
            var self = this;
            if (!this.get("effective_readonly")) {
                this.$input = this.$('input');
                this.$input.minicolors({
                    control: 'hue',
                    defaultValue: '',
                    inline: false,
                    letterCase: 'lowercase',
                    position: 'bottom left',
                    format: this.options.format || 'hex',      // hex, rgb
                    change: function (hex, opacity) {
                        self.internal_set_value(hex || false);
                    },
                    theme: 'bootstrap'
                });
            }
        },
    });

    ListView.Column.include({
        _format: function (row_data, options) {
            var this_options = pyeval.py_eval(this.options || '{}');
            var cell_value = this._super(row_data, options);
            if (this_options.g_field_style) {
                var style_str = '';
                var color_field = this_options.color_field;
                if (color_field) {
                    var color_value = row_data[color_field].value;
                    if (color_value) {
                        style_str = style_str + 'color:' + color_value + ';';
                    }
                }
                var background_color_field = this_options.background_color_field;
                if (background_color_field) {
                    var background_color_value = row_data[background_color_field].value;
                    if (background_color_value) {
                        style_str = style_str + 'background-color:' + background_color_value + ';';
                    }
                }
                return '<span style="' + style_str + '">' + cell_value + '</span>';
            }
            if (this_options.hide_zero && row_data[this.id].value===0) {
                return '';
            }
            return cell_value;
        }
    });

    ColumnChar.include({
        _format: function (row_data, options) {
            if (this.widget == 'minicolors') {
                var value = row_data[this.id].value || '';
                return '<span class="minicolors-swatch minicolors-swatch-readonly"><span class="minicolors-swatch-color" style="background-color: ' + value + ';"></span></span>';
            }
            if (this.widget == 'g_html_link') {
                var value = row_data[this.id].value || '';
                return value;
            }
            return this._super(row_data, options);
        }
    });

    core.form_widget_registry
        .add('minicolors', FieldColor);

    var QRCodeWidget = FieldChar.extend({
        template: 'QRCodeWidget',
        init: function () {
            var self = this;
            this._super.apply(this, arguments);
        },
        start: function () {
            var self = this;
            this._super.apply(this, arguments);
            self.render_value();
        },
        render_value: function () {
            var show_value = this.format_value(this.get('value'), '');
            var width = 400;
            var height = 400;
            if (this.options.size) {
                width = this.options.size[0];
                height = this.options.size[1];
            }
            var path = '/report/barcode?type=QR&width=' + width + '&height=' + height + '&value=' + show_value;
            var $link = this.$el.find('a');
            $link.attr("href", path);
            var $img = this.$el.find('img');
            $img.attr("src", path);
        }
    });
    core.form_widget_registry.add('g_qr_code', QRCodeWidget);

    var GFieldBtn = FieldChar.extend({
        'template': 'GFieldBtn',
        init: function () {
            this._super.apply(this, arguments);
            var lang = this.options.lang || {};
            this.btn_title = lang[this.session.user_context.lang] || this.options.btn_title || _t('查询');
        },
        start: function () {
            this._super.apply(this, arguments);
            var self = this;
            this.$el.find('button').click(function () {
                if (self.g_searching) {
                    return;
                }
                self.g_searching = true;
                var new_value = self.get_value() == 'a' ? 'b' : 'a';
                try {
                    self.set_value(new_value);
                    setTimeout(function () {
                        self.g_searching = false;
                    }, 3000);
                } catch (err) {
                    self.g_searching = false;
                }
                // self.trigger("change:value", self, {
                //     oldValue: 'a',
                //     newValue: 'b'
                // });
                // return $.when();
            });
        }
    });
    core.form_widget_registry.add('g_field_btn', GFieldBtn);


    One2ManyListView.include({
            do_delete: function (ids) {
                var attrs = this.fields_view.arch.attrs;
                if (ids && attrs.ondelete_confirm) {
                    var record = this.records._byId[ids[0]];
                    var context = _.extend({}, record.attributes, {
                        uid: session.uid,
                        current_date: moment().format('YYYY-MM-DD')
                    });
                    var expr = py.parse(py.tokenize(attrs.ondelete_confirm));
                    var message = attrs.ondelete_confirm_message || '您确认要删除这些记录？';
                    if (py.PY_isTrue(py.evaluate(expr, context)) && !confirm(message)) {
                        return;
                    }
                }
                return this._super(ids);
            }
        }
    );

    FieldMany2ManyTags.include({
        render_value: function() {
            if (!this.options.show_name_only) {
                return this._super();
            } else {
                var self = this;
                var values = this.get("value");
                var handle_names = function(_data) {
                    _.each(_data, function(el) {
                        el.display_name = el.name.trim() ? _.str.escapeHTML(el.name) : data.noDisplayContent;
                    });
                    self.render_tag(_data);
                };
                if (!values || values.length > 0) {
                    return this.alive(this.get_render_data(values)).done(handle_names);
                } else {
                    handle_names([]);
                }
            }
        },
    });

    // selection 字段时间线 只读，以后加可以编辑
    var FieldSelectionTimeline = form_common.AbstractField.extend({
        template: "FieldSelectionTimeline",
        init: function (field_manager, node) {
            this._super(field_manager, node);
            this.options.clickable = this.options.clickable || (this.node.attrs || {}).clickable || false;
            this.options.visible = this.options.visible || (this.node.attrs || {}).statusbar_visible || false;
            this.set({value: false});
            this.selection = {'unfolded': [], 'folded': []};
            this.set("selection", {'unfolded': [], 'folded': []});
            this.selection_dm = new utils.DropMisordered();
            this.dataset = new data.DataSetStatic(this, this.field.relation, this.build_context());
            this.chart_style = this.options.chart_style || 'width: 1000px;height:100px;';
        },
        start: function () {
            var self = this;
            // this.field_manager.on("view_content_has_changed", this, this.calc_domain);
            // this.calc_domain();
            self.SelectionTimelineChart = echarts.init(self.$el.find('.selection_timeline')[0]);
            // if (this.options.clickable) {
            //     this.bind_stage_click();
            // }
            var chart_desc_map = this.options.chart_desc_map || {};
            for (var op in chart_desc_map) {
                this.field_manager.on('field_changed:' + chart_desc_map[op], this, this.render_value);
            }
            this._super();
        },
        render_value: function () {
            var self = this;
            this.SelectionTimelineChart.setOption(this.get_chart_option());
        },
        get_chart_option: function () {
            var self = this;
            var selection = this.options.chart_selection || this.field.selection;
            var field_value = this.get('value');
            var line_len = _.findIndex(selection, function (s) {
                return s[0] == field_value
            }) + 1;
            var chart_desc_map = this.options.chart_desc_map || {};
            var chart_desc_flag = this.options.chart_desc_flag || '';
            var data_list = selection.map(function (item, i) {
                var itemStyle = {};
                if (i > line_len - 1) {
                    itemStyle = {
                        normal: {
                            color: "#d4d8d9",
                            shadowColor: '#d4d8d9',
                        }
                    };
                } else if (i == line_len - 1) {
                    itemStyle = {
                        normal: {
                            color: "#fff",
                            borderColor: "#1798ea",
                            shadowColor: '#1798ea',
                        }
                    };
                }
                var desc = item[1];
                var desc_field = chart_desc_map[item[0]];
                if (desc_field) {
                    var desc_field_value = self.field_manager.get_field_value(desc_field);
                    if (desc_field_value) {
                        desc = desc + '(' + desc_field_value + chart_desc_flag + ')'
                    }
                }
                return {
                    name: desc,
                    x: 100 * (i + 1),
                    y: 100,
                    value: item[0],
                    itemStyle: itemStyle
                };
            });
            var links_list = selection.map(function (item, i) {
                var color = "#1798ea";
                if (i > line_len - 2) {
                    color = "#d4d8d9";
                }
                return {
                    source: i,
                    target: i + 1,
                    lineStyle: {
                        normal: {
                            color: color
                        }
                    }
                };
            });
            links_list.pop();

            return {
                title: {
                    text: ' '
                },
                tooltip: {
                    // alwaysShowContent:true,
                    // enterable:true,
                    // formatter: '<img src="/web/binary/image?model=res.users&field=image_small&id=1" alt="echarts logo"/>'
                },
                animationDurationUpdate: 1500,
                animationEasingUpdate: 'quinticInOut',
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        symbolSize: 20,
                        roam: false,
                        label: {
                            normal: {
                                show: true,
                                position: 'top',
                                textStyle: {
                                    color: "#1798ea"
                                }
                            }
                        },
                        edgeSymbol: ['circle', 'arrow'],
                        edgeSymbolSize: [4, 0],
                        edgeLabel: {
                            normal: {
                                textStyle: {
                                    fontSize: 20
                                }
                            }
                        },
                        itemStyle: {
                            normal: {
                                color: "#1798ea",
                                // shadowColor: 'rgba(0, 0, 0, 0.5)',
                                // shadowBlur: 10
                                // color: "#1798ea",
                                shadowColor: '#1798ea',
                                shadowBlur: 15,
                                borderWidth: 2,
                                borderColor: "#fff"
                            }
                        },
                        data: data_list,
                        links: links_list,
                        lineStyle: {
                            normal: {
                                opacity: 0.9,
                                width: 2,
                                curveness: 0
                            }
                        }
                    }
                ]
            }
        },
        _toggle_label: function () {
        },
    });
    core.form_widget_registry.add('selection_timeline', FieldSelectionTimeline);

    // selection 字段 里程碑图
    var FieldSelectionGateway = FieldSelectionTimeline.extend({
        init: function (field_manager, node) {
            this._super(field_manager, node);
            this.chart_style = this.options.chart_style || 'width: 1000px;height:110px;';

        },
        start: function () {
            var self = this;
            this._super();
            var dep_fields = ['g1_actual_date', 'g2_actual_date', 'g3_actual_date', 'g4_actual_date', 'g5_actual_date',
                'g6_actual_date', 'g7_actual_date', 'g8_actual_date', 'g1_plan_date', 'g2_plan_date', 'g3_plan_date',
                'g4_plan_date', 'g5_plan_date',
                'g6_plan_date', 'g7_plan_date', 'g8_plan_date', 'risk_level', 'name']
            for (var j = 0, len = dep_fields.length; j < len; j++) {
                this.field_manager.on('field_changed:' + dep_fields[j], this, this.render_value);
            }
        },
        render_value: function () {
            var self = this;
            if (!this.SelectionTimelineChart) {
                return
            }
            this.SelectionTimelineChart.setOption(this.get_chart_option());
        },
        get_chart_option: function () {
            var self = this;
            var selection = this.options.chart_selection || this.field.selection;

            //节点颜色
            var all_gate_color = this.field_manager.get_field_value('all_gate_color');
            var all_gate_color_list;
            if (all_gate_color) {
                all_gate_color_list = all_gate_color.split(',');
            } else {
                all_gate_color_list = ['#d4d8d9', '#d4d8d9', '#d4d8d9', '#d4d8d9', '#d4d8d9', '#d4d8d9', '#d4d8d9', '#d4d8d9'];
            }
            // var is_close = this.field_manager.get_field_value('g8_actual_date');
            // console.log(is_close);
            var next_gate = this.get('value');
            // console.log(next_gate);
            var next_gate_index = _.findIndex(selection, function (s) {
                return s[0] == next_gate
            });
            // var chart_desc_map = this.options.chart_desc_map || {};
            // var chart_desc_flag = this.options.chart_desc_flag || '';

            //距离下一节点天数
            var days_to_next_gate = '距离下一节点:' + this.field_manager.get_field_value('days_to_next_gate') + '天';
            var data_list = selection.map(function (item, i) {
                //所有节点的颜色需要动态配置
                var itemStyle = {
                    normal: {
                        color: all_gate_color_list[i],
                        shadowColor: '#d4d8d9',
                    }
                };
                var desc = item[1];
                // var desc_field = chart_desc_map[item[0]];
                // if (desc_field) {
                //     var desc_field_value = self.field_manager.get_field_value(desc_field);
                //     if (desc_field_value) {
                //         desc = desc + '(' + desc_field_value + chart_desc_flag + ')'
                //     }
                // }
                //添加滑动提示文本
                // console.log('g' + (i + 1) + '_plan_date', 'g' + (i + 1) + '_actual_date')
                var plan_date = self.field_manager.get_field_value('g' + (i + 1) + '_plan_date')
                if (!plan_date) {
                    plan_date = ""
                }
                var actual_date = self.field_manager.get_field_value('g' + (i + 1) + '_actual_date')
                if (!actual_date) {
                    actual_date = ""
                }

                var tip_content = '计划日期:' + plan_date + '<br/>' + '实际日期:' + actual_date
                return {
                    name: desc,
                    x: 100 * (i + 1),
                    y: 100,
                    value: tip_content,
                    itemStyle: itemStyle,
                };
            });
            //加入移动节点
            if (next_gate) {
                data_list.push({
                    name: days_to_next_gate,
                    x: 100 * (next_gate_index + 1),
                    y: 60,
                    symbolSize: 1,
                    itemStyle: {
                        normal: {
                            // opacity: 1
                        },
                    },
                    label: {
                        normal: {

                            position: 'top',

                        }
                    }
                });
            }
            var links_list = selection.map(function (item, i) {
                var color = "#1798ea";
                return {
                    source: i,
                    target: i + 1,
                    lineStyle: {
                        normal: {
                            color: color
                        }
                    }
                };
            });
            links_list.pop();
            if (next_gate) {
                links_list.push({
                    source: data_list.length - 1,
                    target: next_gate_index,
                    lineStyle: {
                        normal: {
                            color: "#1798ea"
                        }
                    }
                });
            }

            return {
                title: {
                    text: ''
                },
                tooltip: {
                    formatter: function (params, ticket, callback) {
                        var showContent = params.value;

                        return showContent;
                    }
                },
                animationDurationUpdate: 1500,
                animationEasingUpdate: 'quinticInOut',
                series: [
                    {
                        type: 'graph',
                        layout: 'none',
                        symbolSize: 20,
                        roam: false,
                        label: {
                            normal: {
                                show: true,
                                position: 'bottom',
                                textStyle: {
                                    color: "#1798ea"
                                }
                            }
                        },
                        edgeSymbol: ['circle', 'arrow'],
                        edgeSymbolSize: [4, 10],
                        edgeLabel: {
                            normal: {
                                textStyle: {
                                    fontSize: 10
                                }
                            }
                        },
                        data: data_list,
                        // links: [],
                        links: links_list,
                    }
                ]
            }
        },
    });
    core.form_widget_registry.add('selection_gateway', FieldSelectionGateway);
    var CustomButton = form_common.FormWidget.extend({
        template: 'geely_widgets.CustomButton',
        events: {},
        init: function () {
            this._super.apply(this, arguments);
            this.options = pyeval.py_eval(this.node.attrs.options || '{}');
            if (this.options.method == 'export_excel_x2m' || this.options.method == 'export_excel_custom') {
                this.options = _.extend(this.options, {
                    'title': '',
                    'class': 'oe_right oe_read_only',
                    'icon': 'fa fa-file-excel-o',
                    'btn_title': '导出 xls'
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
            var x2m_field = this.view.fields[this.options.field];
            var x2m_list_view = x2m_field.viewmanager.views.list.controller;
            $.blockUI();
            var export_columns_keys = [];
            var export_columns_names = [];
            $.each(x2m_list_view.visible_columns, function () {
                if (this.tag == 'field' && (this.widget === undefined || this.widget != 'handle')) {
                    export_columns_keys.push(this.id);
                    export_columns_names.push(this.string);
                }
            });
            this.session.get_file({
                url: '/web/export/x2m',
                data: {
                    data: JSON.stringify({
                        model: this.view.dataset.model,
                        active_id: this.view.datarecord.id,
                        field: field_name,
                        filename: filename,
                        headers: export_columns_names,
                        fields: export_columns_keys
                    })
                },
                complete: $.unblockUI
            });
        },
        export_excel_custom: function () {
            $.blockUI();
            var params = this.options.params || {};
            params.active_id = this.view.datarecord.id;
            session.get_file({
                url: '/web/export/g_common',
                data: {
                    data: JSON.stringify({
                        model: this.options.model,
                        method: this.options.export_method || false,
                        params: params
                    })
                },
                complete: $.unblockUI
            });
        },
        pop_form: function () {
            var self = this;
            var context = self.field_manager.build_eval_context().eval();
            var model_obj = new Model(self.field_manager.model);
            var view_form = self.view.ViewManager.view_form;
            model_obj.call('load_pop_form_action', [self.field_manager.dataset.ids, self.options, context]).then(function(res){
                var pop = new form_common.FormViewDialog(self, res.action).open();
                if (res.hide_footer) {
                    pop.$footer.hide();
                }
                pop.on('write_completed', self, function(){
                    // var ttt = 1;
                    // view_form.reload();
                });
                pop.on('closed', self, function(ev) {
                    if (pop.callback_data) {
                        var field_values = pop.callback_data.field_values;
                        if (field_values) {
                            _.each(field_values, function (f) {
                                if (f.field_type=='number') {
                                    self.field_manager.set_values(eval('({'+f.field+':'+f.value+'})'));
                                } else {
                                    self.field_manager.set_values(eval('({'+f.field+':"'+f.value+'"})'));
                                }
                            })
                        }
                    }
                });
            });
        }
    });
    core.form_custom_registry.add('custom_button', CustomButton);


    var FormToggle = form_common.FormWidget.extend({
        template: 'geely_widgets.FormToggle',
        events: {},
        init: function () {
            this._super.apply(this, arguments);
            this.options = pyeval.py_eval(this.node.attrs.options || '{}');
            if (!this.options.lang) {
                this.options.lang = {};
            }
        },
        start: function () {
            this._super.apply(this, arguments);
            var self = this;
            self.$icon = self.$el.find('i');
            this.$el.click(function () {
                var $target = self.view.$el.parent().find(self.options.target);
                var do_fold = self.$icon.hasClass('fa-chevron-up');
                $target.animate({height: 'toggle'},500,'swing',function() {
                        if ($target.hasClass('o_form_field_empty')) {
                            if (do_fold) {
                                $target.css("cssText","display:none !important");
                            } else {
                                $target.css("cssText","display:block !important");
                            }
                        }
                    }
                );
                self.$icon.toggleClass('fa-chevron-down');
                self.$icon.toggleClass('fa-chevron-up');
            });
        },
    });
    core.form_custom_registry.add('g_form_toggle', FormToggle);

    var DateYearWidget = Datepicker.DateWidget.extend({
        type_of_date: 'date_year',
        init: function (parent, options) {
            this._super.apply(this, arguments);
            this.options.format = 'YYYY';
            this.options.viewMode = 'years';
            this.options.minViewMode = 'years';
        }
    });
    var FieldDateYear = core.form_widget_registry.map.date.extend({
        build_widget: function () {
            return new DateYearWidget(this);
        },
    });
    core.form_widget_registry.add('date_year', FieldDateYear);

    var DateMonthWidget = Datepicker.DateWidget.extend({
        type_of_date: 'date_month',
        init: function (parent, options) {
            this._super.apply(this, arguments);
            this.options.format = 'YYYY-MM';
            this.options.viewMode = 'months';
            this.options.minViewMode = 'months';
        }
    });
    var FieldDateMonth = core.form_widget_registry.map.date.extend({
        build_widget: function () {
            return new DateMonthWidget(this);
        },
    });
    core.form_widget_registry.add('date_month', FieldDateMonth);

    var FieldClockPicker = FieldFloat.extend({
        'template': 'FieldClockPicker',
        initialize_content: function() {
            var self = this;
            if (!this.get("effective_readonly")) {
                var change_func = function(newVal, oldVal) {
                    self.internal_set_value(self.parse_value(newVal));
                };
                this.$input = this.$('input');
                // $input.val(this.format_value(this.get('value'), ''));
                this.$input.clockTimePicker({onChange:change_func});
            }
        },
        parse_value: function(val, def) {
            return formats.parse_value(val, {type: 'float_time'}, def);
        },
        format_value: function(val, def) {
            return formats.format_value(val, {type: 'float_time'}, def);
        },
    });
    core.form_widget_registry.add('field_clock_picker', FieldClockPicker);

    var ColumnClockPicker = ListView.Column.extend({
        _format: function (row_data, options) {
           return formats.format_value(row_data[this.id].value || 0, {type: 'float_time'}, '');
        }
    });

    list_widget_registry.add('field.field_clock_picker', ColumnClockPicker);

    var LodopReport = function (element, action) {
        var LODOP = getLodop();
        if (!LODOP.PRINT_INIT) {
            return;
        }
        eval(action.params.code);
        LODOP.PREVIEW();
    };


    core.action_registry.add("lodop_report", LodopReport);







});