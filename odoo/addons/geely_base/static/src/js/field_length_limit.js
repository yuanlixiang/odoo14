odoo.define('ListFieldLengthLimit', function (require) {
    "use strict"

    const AbstractField = require('web.AbstractField');
    const {FieldText} = require('web.basic_fields');
    const registry = require('web.field_registry');
    let ListRenderer = require('web.ListRenderer')
    let TreeLevelListRenderer = require('tree_level.FieldOne2Many')

    ListRenderer.include({
        /**
         * 限制list字段显示长度，在tree里增加length_limit="10" 设置想要限制的长度
         * @override
         */
        _renderBodyCell: function (record, node, colIndex, options) {
            let res = this._super(record, node, colIndex, options)
            if (this.arch.attrs.length_limit) {

                let length_limit = this.arch.attrs.length_limit
                // if (node.attrs.options) {
                //     let attrs_options = pyUtils.py_eval(node.attrs.options)
                //     if (attrs_options.length_limit) length_limit = attrs_options.length_limit
                // }

                if (options.mode === 'readonly') {
                    const name = node.attrs.name;
                    const field = this.state.fields[name];

                    if (field && ['char', 'text', 'many2one', 'selection'].includes(field.type)) {
                        if (res.html().length > length_limit) {
                            res.html(`${res.html().slice(0, length_limit)}...`)
                        }

                    }
                }
            }

            return res
        }
    })

    TreeLevelListRenderer.include({
        /**
         * 限制list字段显示长度，在tree里增加length_limit="10" 设置想要限制的长度
         * @override
         */
        _renderBodyCell: function (record, node, colIndex, options) {
            let res = this._super(record, node, colIndex, options)

            if (this.arch.attrs.length_limit) {

                let length_limit = this.arch.attrs.length_limit

                if (options.mode === 'readonly') {
                    const name = node.attrs.name;
                    const field = this.state.fields[name];

                    if (field && ['char', 'text', 'many2one', 'selection'].includes(field.type)) {
                        if (res.html().length > length_limit) {
                            res.html(`${res.html().slice(0, length_limit)}...`)
                        }

                    }
                }
            }

            return res
        }
    })

    const FieldEllipsis = FieldText.extend({
        // supportedFieldTypes: ['text'],
        //
        // init: function (parent, options) {
        //     this._super.apply(this, arguments);
        // },

        _renderReadonly: function () {
            const {el} = this;
            el.classList.add('text_ellipsis')
            const formatValue = this._formatValue(this.value);
            el.innerText = formatValue;
            el.title = formatValue;

        },


    })
    registry.add('text_ellipsis', FieldEllipsis);

})