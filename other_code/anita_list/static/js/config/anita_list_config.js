odoo['define']('anita_list.list_config', function (require) {
    'use strict';
    var Widget = require('web.Widget');
    var core = require('web.core');

    return Widget.extend({
        template: 'anita_list.list_config',
        events: {
            'click .tab_item': '_onTabItemClick',
            'click .tab_item_close': '_on_tab_item_close',
            'click .add-new-group': '_onAddNewGroup',
            'click .remove_column': '_onRemoveColumn',
            'click .save_column_config': '_onSaveColumnConfig',
            'click .cancel_column_config': '_onCancelColumnConfig',
            'click .toggle_visible': '_onToggleVisible',
            'click .lock_column': '_onLockColumn',
            'click .reset_settings': '_onResetSettings'
        },
        init: function (parent, params) {
            this._super.apply(this, arguments);
            this["header_arch"] = [];
            this["fields"] = [];
            this["invisible_fields"] = [];
            this['nested_sorters'] = [];
            this.isX2Many = params;
            this["anita_user_data"] = undefined;
        },
        willStart: function () {
            let self = this;
            return this._super.apply(this, arguments).then(function () {
                if (self.isX2Many) {
                    let model = self.getParent()["state"]['model'];
                    return self._rpc({
                        model,
                        method: 'fields_get',
                        args: []
                    }).then(function (fields) {
                        self['fields'] = fields;
                        for (let field in fields) {
                            fields[field]["name"] = field;
                        }
                    });
                }
            });
        },
        _onRemoveColumn: function (ev) {
            ev.stopPropagation();
            ev.preventDefault();

            const $target = $(ev.currentTarget),
                $invisibleFields = this.$('.invisible_fields'),
                $listGroupItem = $target.closest('.list-group-item'),
                $listGroup = $listGroupItem.find('.list-group');

            _.each($listGroup, function (listGroupEl) {
                let $listGroupEl = $(listGroupEl);
                if ($listGroupEl["find"]('.list-group-item')["length"] === 0) {
                    $listGroupEl.detach();
                    $listGroupEl.appendTo($invisibleFields)
                }
            });

            $listGroupItem.remove();
        },
        _onAddNewGroup: function (ev) {
            ev.stopPropagation();
            ev.preventDefault();

            var $newGroupName = this.$('.new-group-name');
            let newGroupName = $newGroupName.val();

            if (newGroupName) {
                $(core["qweb"]["render"]('anita_list.column_group_item', {
                    'column': {
                        'name': newGroupName
                    },
                    'widget': this
                })).appendTo(this.$('.column_config_container'));
                $newGroupName.val('')
                this._reInitNestedSorts()
            }
        },
        _sameAsParent: function (val) {
            let parent = val["parent"];
            return !!parent && parent["name"] === val['name'];
        },
        _reInitNestedSorts: function () {
            for (let i = 0x0; i < this.nested_sorters.length; i++)
                this.nested_sorters[i].destroy();

            let nested_sorters = [];
            for (let nestedSortableEls = Array.prototype.slice.call(this.$el[0].querySelectorAll('.nested-sortable')), i = 0; i < nestedSortableEls.length; i++) {
                let sortable = new Sortable(nestedSortableEls[i], {
                    group: 'column_config',
                    animation: 150,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,
                    handle: '.drag_handle'
                });
                nested_sorters.push(sortable);
            }
            this.nested_sorters = nested_sorters;
        },
        _isField: function (res) {
            return !res.children || !res.children.length || (!(!res.tag || res.tag === 'field') || !(!this._isAllChidrenSame(res) || res.parent));
        },
        ensureDelayItems: function (header_arch, fields, hidden_fields, render_invisible_fields, anita_user_data) {
            this.$('.sorter_container').empty();
            this.header_arch = header_arch;
            this.anita_user_data = anita_user_data;
            this.hidden_fields = hidden_fields;
            this.render_invisible_fields = render_invisible_fields;
            this._postDealHeaderArch();
            // this['header_arch'] = this['header_arch'];

            if (!this.isX2Many) {
                this.fields = [];
                for (let fieldName in fields) {
                    let field = _.clone(fields[fieldName]);
                    field.name = fieldName;
                    this.fields.push(field);
                }
            }
            this._getInvisibleColumn();
            this.column_config = $(core.qweb.render('anita_list.column_config', {
                'widget': this
            }));
            this.column_config.appendTo(this.$('.sorter_container'));
            this._reInitNestedSorts();
            this.invisible_sorter = new Sortable(this.$el[0].querySelector('.invisible_fields'), {
                'group': 'column_config',
                'animation': 150,
                'handle': '.drag_handle'
            });
            this.$('#settings').empty();
            $(core.qweb.render('anita_list.settings', {
                'widget': this
            })).appendTo(this.$('#settings'));
        },
        _postDealHeaderArch: function () {
            let header_arch = this.header_arch;
            _.each(header_arch, function (arch) {
                arch['children'] && _.each(arch['children'], function (res) {
                    res["parent"] = arch;
                });
            });
        },
        isHidenFields: function (field) {
            let fieldName = field["name"] || field['attrs'] && field["attrs"]["name"];
            return -1 !== _.findIndex(this.hidden_fields, function (hiddenField) {
                return hiddenField["name"] === fieldName || hiddenField["attrs"] && hiddenField['attrs']["name"] === fieldName;
            });
        },
        _isAllChidrenSame: function (field) {
            let result = true,
                children = field.children;
            while (children && children.length > 0) {
                if (children.length > 1) {
                    result = false;
                    break;
                }
                let child = children[0];
                if (child.name !== field.name) {
                    result = false;
                    break;
                }
                children = child.children;
            }
            return result;
        },
        _getInvisibleColumn: function () {
            let _0x4c530c = this,
                _0x9c98d8 = [],
                _0x266c25 = {};
            _.each(this.header_arch, function (_0xca4b17) {
                ! function _0x5c371f(_0x5f5122) {
                    let _0x246a5a = _0x5f5122["children"];
                    if (_0x246a5a && 0x0 != _0x246a5a['length']) {
                        for (let _0x47ee9d = 0x0; _0x47ee9d < _0x246a5a["length"]; _0x47ee9d++) _0x5c371f(_0x246a5a[_0x47ee9d]);
                    } else _0x9c98d8["push"](_0x5f5122);
                }(_0xca4b17);
            });
            _.each(_0x9c98d8, function (_0x6b667b) {
                _0x266c25[_0x6b667b['name'] || _0x6b667b["attrs"]["name"]] = _0x6b667b;
            });
            let _0x4ed28e = this.render_invisible_fields;
            _.each(this.fields, function (_0x324f7e) {
                _0x324f7e["name"] in _0x4c530c["hidden_fields"] || _0x266c25[_0x324f7e["name"]] || _0x4ed28e.push(_0x324f7e);
            });
            this.invisible_fields = _0x4ed28e;
        },
        _onTabItemClick: function (ev) {
            var $el = $(ev.currentTarget),
                _0x157f77 = $el.data('tab-id');
            this.$('.tab_item').removeClass('active');
            $el.addClass('active');
            this.$('.tab_content .active').removeClass('active');
            this.$('.tab_content #' + _0x157f77).addClass('active');
        },
        _getColumnName: function (_0x131aa7) {
            let _0x5beb98 = _0x131aa7["name"];
            if (!_0x5beb98 && _0x131aa7["attrs"]) {
                _0x5beb98 = _0x131aa7["attrs"]['name']
            }
            return _0x5beb98;
        },
        _getColumnString: function (_0x4d4b5f) {
            let _0x35f26c = _0x4d4b5f["string"] || _0x4d4b5f['name'];
            if (!_0x35f26c && _0x4d4b5f["attrs"]) {
                _0x35f26c = _0x4d4b5f['attrs']["string"] || _0x4d4b5f["attrs"]["name"]
            }
            return _0x35f26c;
        },
        _getCurrentColumnConfig: function () {
            let listGroupItems = this.$('.column_config_container .list-group-item'),
                configs = [];

            for (let index = 0; index < listGroupItems.length; index++) {
                let $item = $(listGroupItems[index]);
                if ($item.find('.nested-sortable').length === 0) {
                    let listGroupItem = $item.parents('.list-group-item');
                    let parents = [];
                    for (let i = 0; i < listGroupItem.length; i++) {
                        let columnName = $(listGroupItem[i]).data('column-name');
                        parents.push(columnName);
                    }

                    let $inputEl = $item.find('input'),
                        columnWidth = 0;
                    columnWidth = $item.find('.width_policy').val() !== 'auto' && $inputEl.attr('column-width');

                    let visible = $item.find('.toggle_visible').hasClass('icon-visible');
                    let fixedFeft = false,
                        fixedRight = false;
                    if ($item.find('.lock_column').hasClass('icon-lock')) {
                        if (!configs.length)
                            fixedFeft = true;
                        else
                            configs[configs.length - 1]["fixed_left"] ? fixedFeft = true : fixedRight = true;
                    }
                    let config = {
                        'name': $item.data('column-name'),
                        'parent': parents.join('.'),
                        'order': configs.length + 1,
                        'string': $inputEl.val(),
                        'visible': visible,
                        'width': columnWidth,
                        'fixed_left': fixedFeft,
                        'fixed_right': fixedRight
                    };
                    configs.push(config);
                }
            }
            return configs;
        },
        _getSettings: function () {
            return {
                'has_serials': this.$('#has_serials').prop('checked'),
                'enable_virtual_scroll': this.$('#enable_virtual_scroll').prop('checked'),
                'force_readonly': this.$('#force_readonly').prop('checked'),
                'show_search_row': this.$('#show_search_row').prop('checked'),
                'border_style': this.$('#border_style').val(),
                'enable_anita_list': this.$('#enable_anita_list').prop('checked'),
                'tree_column': this.$('#tree_column').val(),
                'expand_row_template': this.$('#expand_row_template').val()
            };
        },
        _onSaveColumnConfig: function (ev) {
            ev["preventDefault"]();
            ev['stopPropagation']();

            this.hide();

            this.trigger_up('anita_list.update_user_settings', {
                'columns': this._getCurrentColumnConfig(),
                'fields': this.fields,
                'settings': this._getSettings()
            });
        },
        _onCancelColumnConfig: function (ev) {
            ev["preventDefault"]();
            ev['stopPropagation']();

            this.hide();
        },
        _onToggleVisible: function (ev) {
            let $target = $(ev.currentTarget);
            if ($target.hasClass('icon-visible')) {
                $target.removeClass('icon-visible');
                $target.removeClass('btn-success');
                $target.addClass('icon-invisible');
                $target.addClass('btn-secondary')
            } else {
                $target.removeClass('icon-invisible');
                $target.removeClass('btn-secondary');
                $target.addClass('icon-visible');
                $target.addClass('btn-success')
            }
        },
        hide: function () {
            this.$el && this.$el.removeClass('show');
        },
        show: function () {
            this.$el.addClass('show');
        },
        _onLockColumn: function (ev) {
            let $target = $(ev.currentTarget);
            if ($target.hasClass('icon-lock')) {
                $target.removeClass('icon-lock');
                $target.addClass('icon-unlock')
            } else {
                $target.removeClass('icon-unlock');
                $target.addClass('icon-lock')
            }
        },
        _isFixedColumn: function (_0x37507d) {
            return !(!_0x37507d['fixed_left'] && !_0x37507d["fixed_right"]);
        },
        _onResetSettings: function (ev) {
            this.trigger_up('anita_list.reset_settings');
        },
        _getCurrentConfig: function (_0x11fb4d) {
            if (this.anita_user_data)
                return this.anita_user_data[_0x11fb4d];

            switch (_0x11fb4d) {
                case 'has_serials':
                    return true;
                case 'enable_virtual_scroll':
                case 'force_readonly':
                    return false;
                case 'show_search_row':
                    return true;
                case 'border_style':
                    return 'bordered';
                case 'enable_anita_list':
                    return true;
            }
        }
    });
})