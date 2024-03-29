 odoo.define('geely_base.employee_many2x_query', function (require) {
"use strict";

    const registry = require('web.field_registry');
    const {FieldMany2ManyTags, FieldMany2One, FieldOne2Many} = require('web.relational_fields');
    const { sprintf } = require("web.utils");
    const viewDialogs = require('web.view_dialogs');
    const ListRenderer = require('web.ListRenderer');
    const FormRenderer = require('web.FormRenderer');
    const FormView = require('web.FormView');
    const FormController = require('web.FormController');
    const viewRegistry = require('web.view_registry');
    const core = require('web.core');

    const customFormViewDialog = viewDialogs.FormViewDialog.extend({
        start: function () {
            core.bus.on('selected_close', this, this._onSelectedClose);
            return this._super.apply(this, arguments);
        },
        destroy: function () {
            core.bus.off('selected_close', this, this._onSelectedClose);
            return this._super(...arguments);
        },
        async _onSelectedClose(){
            await this._save();
            this.close()
        },
    });

    /*
    * employee字段，查询下拉增加”查询 xx“项，点击打开员工查询窗体视图geely_base.geely_ehr_update_wizard_form
    */
    const EmployeeMany2OneQueryField = FieldMany2One.extend({

        async _search(searchValue = ""){
            const values = await this._super.apply(this, arguments);
            const value = searchValue.trim();
            // 增加查询功能
            if (value.length) {
                values.push({
                    label: sprintf(`查询 "<strong>%s</strong>"`, value),
                    action: () => this._onEmployeeQuery(value),
                    classname: 'o_m2o_dropdown_option'
                });
            }
            return values
        },
        _onEmployeeQuery(value){
            new customFormViewDialog(this, {
                res_model: 'geely.ehr.update.wizard',
                res_id: false,
                context: {
                    default_employee_login: value,
                    default_employee_no: value,
                    default_employee: value,
                },
                title: '查询员工',
                view_id: false,
                views: [[false, 'form']],
                readonly: false,
                on_saved: this._onEmployeeSelected.bind(this),
                buttons: [{
                    text: '选择',
                    classes: "btn-primary",
                    click: function () {
                        core.bus.trigger('selected_close')
                    }
                }, {
                    text: '关闭',
                    classes: "btn-secondary o_form_button_cancel",
                    close: true,
                    click: ()=>this._onDialogClosedUnset()
                }],
            }).open();
        },
        _onEmployeeSelected(record){
            const employee = record.data.employee_id;
            if(!employee){
                this._onDialogClosedUnset()
            }
            else{
                this.reinitialize(employee.data)
            }
        }
    });

    /*
    * employee字段，查询下拉增加”查询 xx“项，点击打开员工查询窗体视图geely_base.geely_ehr_update_wizard_form
    */
    const EmployeeMany2ManyQueryField = FieldMany2ManyTags.extend({
        _renderEdit: function () {
            var self = this;
            this._renderTags();
            if (this.many2one) {
                this.many2one.destroy();
            }
            this.many2one = new FieldMany2One(this, this.name, this.record, {
                mode: 'edit',
                noOpen: true,
                noCreate: !this.canCreate,
                viewType: this.viewType,
                attrs: this.attrs,
            });
            // to prevent the M2O to take the value of the M2M
            this.many2one.value = false;
            // to prevent the M2O to take the relational values of the M2M
            this.many2one.m2o_value = '';

            this.many2one._getSearchBlacklist = function () {
                return self.value.res_ids;
            };
            var _getSearchCreatePopupOptions = this.many2one._getSearchCreatePopupOptions;


            this.many2one._getSearchCreatePopupOptions = function (view, ids, context, dynamicFilters) {
                var options = _getSearchCreatePopupOptions.apply(this, arguments);
                var domain = this.record.getDomain({fieldName: this.name});
                var m2mRecords = [];
                return _.extend({}, options, {
                    domain: domain.concat(["!", ["id", "in", self.value.res_ids]]),
                    disable_multiple_selection: false,
                    on_selected: function (records) {
                        m2mRecords.push(...records);
                    },
                    on_closed: function () {
                        self.many2one.reinitialize(m2mRecords);
                    },
                });
            };

            const _search = this.many2one._search;
            this.many2one._autocompleteSources[0].method = async (searchValue = '')=>{
                const values = await _search.call(this.many2one, searchValue);

                const value = searchValue.trim();
                // 增加查询功能
                if (value.length) {
                    values.push({
                        label: sprintf(`查询 "<strong>%s</strong>"`, value),
                        action: () => this._onEmployeeQuery(value),
                        classname: 'o_m2o_dropdown_option'
                    });
                }
                return values
            };
            return this.many2one.appendTo(this.$el);
        },

        _onEmployeeQuery(value){
            new customFormViewDialog(this, {
                res_model: 'geely.ehr.update.wizard',
                res_id: false,
                context: {
                    default_employee_login: value,
                    default_employee_no: value,
                    default_employee: value,
                },
                title: '查询员工',
                view_id: false,
                views: [[false, 'form']],
                readonly: false,
                on_saved: this._onEmployeeSelected.bind(this),
                buttons: [{
                    text: '选择',
                    classes: "btn-primary",
                    click: function () {
                        core.bus.trigger('selected_close')
                    }
                }, {
                    text: '关闭',
                    classes: "btn-secondary o_form_button_cancel",
                    close: true,
                    click: ()=>this.many2one._onDialogClosedUnset()
                }],
            }).open();
        },
        _onEmployeeSelected(record){
            const employee = record.data.employee_id;
            if(!employee){
                this.many2one._onDialogClosedUnset()
            }
            else{
                this.many2one.reinitialize(employee.data)
            }
        },

    });

    /*
    * geely.ehr.employee.wizard的line_ids字段自定义widget，点击列表行时，让select字段选中，并触发"record_selected"以模拟”确定“按钮单击
    */
    const EmployeeOne2ManySelectRenderer = ListRenderer.extend({
        _onRowClicked(ev){
            if (!ev.target.closest('.o_list_record_selector') && !ev.target.closest('.exclude_select') && !$(ev.target).prop('special_click')) {
                var dataPointID = $(ev.currentTarget).data('id');
                if (dataPointID) {
                    this.trigger_up('set_dirty', {dataPointID});

                    const changes = {select: true};
                    this.trigger_up('field_changed', {
                        dataPointID,
                        changes,
                        viewType: 'default',
                        onSuccess: ()=>{
                            this.trigger_up('record_selected');
                        },
                        onFailure: err=>{},
                    });

                }
            }
        }
    });

    const EmployeeOne2ManySelectField = FieldOne2Many.extend({
        _getRenderer(){
            return EmployeeOne2ManySelectRenderer
        }
    });

    /*
    * geely.ehr.employee.wizard窗体视图，接收record_selected，并模拟”确定“按钮单击
    */
    registry.add('employee_many2one_query', EmployeeMany2OneQueryField)
    .add('employee_many2many_query', EmployeeMany2ManyQueryField)
    .add('employee_one2many_select', EmployeeOne2ManySelectField);

    const ehrEmployeeRenderer = FormRenderer.extend({
        custom_events: _.extend({}, FormRenderer.prototype.custom_events, {
            record_selected: '_onRecordSelected',
        }),
        _onRecordSelected(ev){
            ev.stopPropagation();
            this.trigger_up('button_clicked', {
                attrs: {
                    name: 'btn_confirm',
                    options: {},
                    type: 'object'
                },
                record: this.state,
            });
        }
    });

    const ehrEmployeeFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Renderer: ehrEmployeeRenderer,
        }),
    });

    viewRegistry.add('ehr_employee_form_view', ehrEmployeeFormView)

});