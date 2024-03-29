odoo.define('geely.OpenSearchControl', function (require) {
    "use strict";

    const {Component, hooks} = owl;
    const {xml} = owl.tags
    const {EventBus} = owl.core;
    const {useModel} = require('web/static/src/js/model.js');
    const field_registry = require('web.field_registry_owl');
    const ControlPanel = require('web.ControlPanel')
    const {useState, useExternalListener} = hooks;
    const field_utils = require('web.field_utils');
    const ControlPanelModelExtension = require('web/static/src/js/control_panel/control_panel_model_extension.js')
    const {patch} = require('web.utils')

    let sourceId = 0;
    const CHAR_FIELDS = ['char', 'html', 'many2many', 'many2one', 'one2many', 'text'];

    patch(ControlPanelModelExtension, "geely_base/static/src/js/open_search_control.js", {
        addMutilAutoCompletionValues(values) {
            _.map(values, (value) => {
                this.addAutoCompletionValues(value);
            })
        },
        deactivateGroupAll() {
            this.state.query = [];
            this._checkComparisonStatus();
        }
    });


    class SearchField extends Component {
        constructor(...args) {
            super(...args);
            const {field, envBus} = this.props;
            this.envBus = envBus;
            this.field = field;
            this.state = useState({
                value: '',
            })
            this.envBus.on('clear', this, this._onClear)

        }

        _parseWithSource(rawValue, {type}) {
            const parser = field_utils.parse[type];
            let parsedValue;
            switch (type) {
                case 'date':
                case 'datetime': {
                    const parsedDate = parser(rawValue, {type}, {timezone: true});
                    const dateFormat = type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD';
                    const momentValue = moment(parsedDate, dateFormat);
                    if (!momentValue.isValid()) {
                        throw new Error('Invalid date');
                    }
                    parsedValue = parsedDate.toJSON();
                    break;
                }
                case 'many2one': {
                    parsedValue = rawValue;
                    break;
                }
                default: {
                    parsedValue = parser(rawValue);
                }
            }
            return parsedValue;
        }

        getFilter(value, field, source) {
            let {operator, filterId} = source
            return {
                filterId: filterId,
                value: this._parseWithSource(value, field),
                label: value,
                operator: operator
            }
        }

        onChange() {
            const {envBus} = this.props;
            const {value} = this.state;
            let filters = [this.getFilter(value, this.field, this.props.source)]
            envBus.trigger('searchChange', this.field, filters);
        }

        _onClear() {
            this.state.value = '';
        }
    }

    class CharField extends SearchField {
        constructor(...args) {
            super(...args);
        }

        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
                    <div>
                        <input class="o_input" type="text" t-model="state.value" t-on-change="onChange"/>
                    </div>
                    
                </div>`
    }

    class DateField extends SearchField {
        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
                    <div>
                        <input class="o_input" type="date" t-model="state.value" t-on-change="onChange"/>
                    </div>
                    
                </div>`

    }

    class DatetimeField extends SearchField {
        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
                    <div>
                        <input class="o_input" type="datetime-local" t-model="state.value" t-on-change="onChange"/>
                    </div>
                    
                </div>`

    }

    class BooleanField extends SearchField {
        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
<!--                    <input type="radio" t-att-name="field.name" t-model="state.value" t-on-change="onChange"/> 是-->
<!--                    <input type="radio" t-att-name="field.name" t-model="state.value" t-on-change="onChange"/> 否-->
                    <select class="o_input">
                        <option>是</option>
                        <option>否</option>
                    </select>
                </div>`

    }

    class SelectionField extends SearchField {

        onChange(e) {
            const {envBus} = this.props;
            const value = e.currentTarget.value
            let filters = [this.getFilter(value, this.field, this.props.source)]
            envBus.trigger('searchChange', this.field, filters);
        }

        _onClear() {
            this.state.value = '';
            const selects = document.querySelectorAll('select')
            for (const select of selects){
                select.value = ''
            }
        }

        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
                    <div>
                        <select class="o_input" t-on-change="onChange">
                            <option></option>
                            <option t-foreach="field.selection" t-as="op" t-att-value="op[0]" t-key="op_index">
                                <t t-esc="op[1]"/>
                            </option>
                        </select>
                    </div>

                </div>`

    }

    class NumberField extends SearchField {
        static template = xml`
                <div class="search_field">
                    <span t-att-title="field.string"><t t-esc="field.string"/>：</span>
                    <div>
                        <input class="o_input" type="number" t-att-name="field.name" t-model="state.value" t-on-change="onChange"/>
                    </div>
                    
                </div>`

    }


    class OpenSearchControl extends Component {
        constructor() {
            super(...arguments);
            this.searchModel = useModel('searchModel');
            this.envBus = new EventBus();
            this.envBus.on('searchChange', this, this.searchChange)
            this.searchSource = this.searchModel.get('filters', f => f.type === 'field').map(
                filter => this._createSource(filter)
            ).filter((source) => {
                return source !== false
            });
            this.query = {};
            // useExternalListener(window, 'keydown', this._onWindowKeydown);
        }

        mounted() {
            this._open_close()
        }

        _open_close() {
            let flag = 'close'
            const open_close_div = document.querySelector('.open_close>div')
            const btn_triangle = document.querySelector('.btn_triangle')
            const open_search_control = document.querySelector('.open-search-control')

            const open_search_control_height = open_search_control.clientHeight
            open_close_div.onclick = function () {
                if (flag === 'open') {
                    open_search_control.style.display = 'none'
                    // open_search_control.style.height = 0
                    // open_search_control.style.opacity = 0
                    btn_triangle.style.transform = 'rotate(0deg)'

                    flag = 'close'
                } else {
                    open_search_control.style.display = 'block'
                    // open_search_control.style.height = open_search_control_height + 'px'
                    // open_search_control.style.opacity = 1
                    btn_triangle.style.transform = 'rotate(180deg)'
                    flag = 'open'
                }
            }
        }

        _createSource(filter) {
            const field = this.props.fields[filter.fieldName];
            const type = field.type === "reference" ? "char" : field.type;

            const component_dict = {
                'char': CharField,
                'many2one': CharField,
                'date': DateField,
                'datetime': DatetimeField,
                'boolean': BooleanField,
                'integer': NumberField,
                'selection': SelectionField
            }
            let component = component_dict[type]
            if (!component) {
                return false
            } else {
                return {
                    component,
                    fieldString: field.string,
                    props: {
                        field,
                        envBus: this.envBus,
                        source: {
                            active: true,
                            description: filter.description,
                            filterId: filter.id,
                            filterOperator: filter.operator,
                            id: sourceId++,
                            operator: CHAR_FIELDS.includes(type) ? 'ilike' : '=',
                            parent: false,
                        }
                    }
                }
            }


        }

        searchChange(field, filters) {
            if (filters && !filters[0].value) {
                // 清空该字段
                delete this.query[field.name]
            } else {
                this.query[field.name] = filters;
            }

        }

        _onWindowKeydown(e) {
            if (e.keyCode === 13) {
                this.emitSearch()
            }
        }

        emitSearch() {
            this.searchModel.dispatch('deactivateGroupAll');
            let filters = []
            _.each(Object.values(this.query), (f) => {
                if (f && f.length > 0) {
                    filters = filters.concat(f)
                }
            });

            this.searchModel.dispatch("addMutilAutoCompletionValues", filters);
        }

        onClickSearch() {
            this.emitSearch()
        }

        onClickClear() {
            this.query = {};
            this.searchModel.dispatch('deactivateGroupAll');
            this.envBus.trigger('clear')
        }

    }

    OpenSearchControl.template = 'geely.OpenSearchControl';

    ControlPanel.patch("geely.ControlPanel", (T) => {
        class ControlPanelPatch extends T {
        }

        ControlPanelPatch.components.OpenSearchControl = OpenSearchControl
        return ControlPanelPatch
    })

})