odoo.define('geely_base.x2many_field', function (require) {
    "use strict";

    // X2Many字段批量删除功能

    const {FieldX2Many} = require('web.relational_fields');
    const {FieldOne2Many} = require('web.relational_fields');
    const ListRenderer = require('web.ListRenderer');
    const core = require('web.core');
    const Dialog = require('web.Dialog');
    const qweb = core.qweb;
    const dom = require('web.dom');
    require('web.EditableListRenderer')

    const X2ManyRenderer = ListRenderer.extend({
        init: function (parent, state, params) {
            this._super.apply(this, arguments);

            this.hasSelectors = parent.mode === 'edit';
        },
        _renderSelector: function (tag, disableInput) {
            var $content = dom.renderCheckbox();
            // if (disableInput) {
            //     $content.find("input[type='checkbox']").prop('disabled', disableInput);
            // }
            return $('<' + tag + '>')
                .addClass('o_list_record_selector')
                .append($content);
        },
    });


    FieldX2Many.include({
        custom_events: _.extend({}, FieldX2Many.prototype.custom_events, {
            selection_changed: '_onSelectionChanged',
        }),

        // 重写，增加x2many字段根元素是否可见监听
        init() {
            this._super.apply(this, arguments)
            this.selectedRecords = []

            // 增加x2many字段根元素是否可见监听
            this.fixedClassName = `${this.model.replace(/\./g, '_')}__${this.name}`;
            this._onScroll = this._onScroll.bind(this)

            this.io = new IntersectionObserver((entries)=>{
                if(entries[0].intersectionRatio > 0 && this.value.count){
                    window.addEventListener('scroll', this._onScroll, true);
                }
                else{
                    const el = this.el.querySelector(`.${this.fixedClassName}`)
                    el && el.remove();

                    window.removeEventListener('scroll', this._onScroll, true);
                }
            }, {root: null, threshold: 0, rootMargin: '0px'})
        },

        // 重写，移除滚动事件，释放可见监听
        destroy: function () {
            this.io.disconnect()
            window.removeEventListener('scroll', this._onScroll, true);
            this._super();
        },

        _getRenderer: function () {
            const Renderer = this._super.apply(this)
            if(Renderer === ListRenderer || Renderer instanceof ListRenderer){
                return X2ManyRenderer
            }
            return Renderer
        },

        _renderButtons: function () {
            if (!this.isReadonly && this.view.arch.tag === 'tree' && this.activeActions.delete) {
                const renderingContext = this._getButtonsRenderingContext();
                this.$buttons = $(qweb.render('X2manyField.buttons', Object.assign(renderingContext, {selectedRecordsLength:this.selectedRecords.length})));
                this.$buttons.on('click', this._onDeleteRecords.bind(this));
            }
            else{
                this._super()
            }
        },
        _onDeleteRecords(ev){
            if(ev.currentTarget.classList.contains('o_list_delete')){
                Dialog.confirm(this, '确认要删除选中的记录吗？', {
                    confirm_callback: () => {
                        const operation = this.isMany2Many ? 'FORGET' : 'DELETE';
                        this._setValue({
                            operation,
                            ids: this.selectedRecords,
                        });
                    },
                });
            }
            else{
                const operation = this.isMany2Many ? 'FORGET' : 'DELETE';
                const ids = new Set(this.value.data.map(i=>i.id));
                this.selectedRecords.forEach(id=>ids.delete(id))
                if(ids.size){
                    Dialog.confirm(this, '确认要删除未选中的记录吗？', {
                        confirm_callback: () => {
                            this._setValue({
                                operation,
                                ids: Array.from(ids),
                            });
                        },
                    });
                }

            }

        },
        _onSelectionChanged(ev) {
            this.selectedRecords = ev.data.selection;
            let el = this.el.querySelector('.o_list_delete')
            el && el.classList.toggle('d-none', this.selectedRecords.length <= 0)

            el = this.el.querySelector('.o_list_delete_unselected')
            if (el) {
                const ids = new Set(this.value.data.map(i => i.id));
                this.selectedRecords.forEach(id => ids.delete(id))
                el.classList.toggle('d-none', ids.size <= 0 || this.selectedRecords.length <= 0)
            }
        },

        // 重写，计算导航条和控制面板的高度，观察根元素是否可见
        on_attach_callback: function () {
            this._super.apply(this, arguments)

            // 导航条高度
            const nav = document.querySelector('.o_main_navbar')
            this.navHeight = nav ? nav.getBoundingClientRect().height : 0;
            // 控制面板高度
            const control = document.querySelector('.o_control_panel')
            this.controlHeight = control ? control.getBoundingClientRect().height : 0;

            // form状态栏高度(依赖web_responsive)
            const statusbar = document.querySelector('.o_action_manager > .o_action > .o_content > .o_form_view > .o_form_sheet_bg > .o_form_statusbar')
            this.statusbarHeight = statusbar ? statusbar.getBoundingClientRect().height : 0;

            this.io.observe(this.el)
        },

        // 重写，移除滚动事件，移除可见监听
        on_detach_callback: function () {
            window.removeEventListener('scroll', this._onScroll, true);
            this.io.unobserve(this.el)
            this._super.apply(this, arguments)
        },

        // 水平滚动处理
        _onScrollH(e){
            const target = e.target;
            const el = target.querySelector(`.${this.fixedClassName}`)
            if(el)
                el.scrollLeft = target.scrollLeft
        },

        // 滚动处理
        _onScroll(e) {
            if (!e.target.classList.contains('o_content') && !e.target.classList.contains('o_tree_form_form_container'))
                return this._onScrollH(e)

            const table = this.el.querySelector('.o_list_table');
            const {top} = table.getBoundingClientRect();
            const el = this.el.querySelector(`.${this.fixedClassName}`)
            if (top - this.navHeight - this.controlHeight - this.statusbarHeight < 0) {
                if (el)
                    return;

                const parentEl = table.parentElement;
                const {left, width} = parentEl.getBoundingClientRect();
                const scrollLeft = parentEl.scrollLeft;

                const div = document.createElement('div')
                parentEl.appendChild(div)
                div.style.cssText = `position: fixed; width: ${width}px; left: ${left}px; top: ${this.navHeight + this.controlHeight + this.statusbarHeight}px; overflow: hidden; z-index: 98`;
                div.classList.add(this.fixedClassName);

                const fixedTable = table.cloneNode(false)
                div.appendChild(fixedTable)

                fixedTable.classList.add('o_x2many_fixed_table')
                fixedTable.appendChild(table.querySelector('thead').cloneNode(true))
                fixedTable.querySelectorAll('th').forEach(th => th.classList.remove('o_column_sortable'))
                fixedTable.querySelectorAll('span.o_resize').forEach(s => s.remove())

                div.scrollLeft = scrollLeft;
            } else {
                el && el.remove();
            }
        },
    })

    ListRenderer.include({
        // 重写，在计算列宽时，不重新计算固定表头的的宽度
        _freezeColumnWidths: function () {
            if (!this.columnWidths && this.el.offsetParent === null) {
                // there is no record nor widths to restore or the list is not visible
                // -> don't force column's widths w.r.t. their label
                return;
            }
            const thElements = [...this.el.querySelectorAll('table:not(.o_x2many_fixed_table) thead tr th')];  // xichun
            if (!thElements.length) {
                return;
            }
            const table = this.el.getElementsByClassName('o_list_table')[0];
            let columnWidths = this.columnWidths;

            if (!columnWidths || !columnWidths.length) { // no column widths to restore
                // Set table layout auto and remove inline style to make sure that css
                // rules apply (e.g. fixed width of record selector)
                table.style.tableLayout = 'auto';
                thElements.forEach(th => {
                    th.style.width = null;
                    th.style.maxWidth = null;
                });

                // Resets the default widths computation now that the table is visible.
                this._computeDefaultWidths();

                // Squeeze the table by applying a max-width on largest columns to
                // ensure that it doesn't overflow
                columnWidths = this._squeezeTable();
            }

            thElements.forEach((th, index) => {
                // Width already set by default relative width computation
                if (!th.style.width) {
                    th.style.width = `${columnWidths[index]}px`;
                }
            });

            // Set the table layout to fixed
            table.style.tableLayout = 'fixed';
        },
    })

    FieldOne2Many.include({
        _renderButtons: function () {
            // if (this.activeActions.create) {
            //     return this._super(...arguments);
            // }

            // 修改：需渲染批量删除按钮
            if (!this.isReadonly && this.view.arch.tag === 'tree' && this.activeActions.delete) {
                const renderingContext = this._getButtonsRenderingContext();
                this.$buttons = $(qweb.render('X2manyField.buttons', Object.assign(renderingContext, {selectedRecordsLength:this.selectedRecords.length})));
                this.$buttons.on('click', this._onDeleteRecords.bind(this));
            }else {
                this._super(...arguments)
            }
        },
    })

});