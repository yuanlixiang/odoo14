(function (_0x928a6d) {
    const _0x3a4b99 = a0_0x32ae();
    while (!![]) {
        try {
            //                          column_config                               fixed_right                                 detach                              addClass                                            invisible_sorter                        clone                                   stopPropagation                             appendTo                                then
            const _0x3bd9ef = -parseInt(a0_0x3439(360)) / 1 * (parseInt(a0_0x3439(389)) / 2) + -parseInt(a0_0x3439(384)) / 3 * (-parseInt(a0_0x3439(338)) / 4) + -parseInt(a0_0x3439(354)) / 5 + parseInt(a0_0x3439(388)) / 6 * (parseInt(a0_0x3439(380)) / 7) + parseInt(a0_0x3439(339)) / 8 + parseInt(a0_0x3439(355)) / 9 + parseInt(a0_0x3439(346)) / 10 * (parseInt(a0_0x3439(370)) / 11);
            if (_0x3bd9ef === _0x928a6d) break; else _0x3a4b99['push'](_0x3a4b99['shift']());
        } catch (_0x3ec921) {
            _0x3a4b99['push'](_0x3a4b99['shift']());
        }
    }
}(932918));

odoo['define']('anita_list.list_config', function (require) {
    'use strict';
    const _0x2d26fd = a0_0x3439;
    const Widget = require('web.Widget');
    const core = require('web.core');

    return Widget[a0_0x3439(0x16f)]({
        'template': 'anita_list.list_config',
        'events': {
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
        'init': function (_0x2a8d35, _0x5af21c) {
            const _0x8331be = _0x2d26fd;
            this._super.apply(this, arguments), this[_0x8331be(0x16a)] = [], this[_0x8331be(0x158)] = [], this[_0x8331be(0x164)] = [], this['nested_sorters'] = [], this[_0x8331be(0x174)] = _0x5af21c, this[_0x8331be(0x173)] = void 0x0;
        },
        'willStart': function () {
            const _0x493fe0 = _0x2d26fd;
            let _0xcca278 = this;
            return this._super.apply(this, arguments)[_0x493fe0(0x176)](function () {
                const _0x57054a = _0x493fe0;
                if (_0xcca278[_0x57054a(0x174)]) {
                    let _0x34aec7 = _0xcca278[_0x57054a(0x187)]()[_0x57054a(0x17d)]['model'];
                    return _0xcca278[_0x57054a(0x189)]({
                        'model': _0x34aec7,
                        'method': 'fields_get',
                        'args': []
                    })[_0x57054a(0x176)](function (_0x437cef) {
                        const _0x261add = _0x57054a;
                        _0xcca278['fields'] = _0x437cef;
                        for (let _0x338a3f in _0x437cef) {
                            _0x437cef[_0x338a3f][_0x261add(0x181)] = _0x338a3f;
                        }
                    });
                }
            });
        },
        '_onRemoveColumn': function (_0x15d6d8) {
            const _0x2b2ca9 = _0x2d26fd;
            _0x15d6d8[_0x2b2ca9(0x147)](), _0x15d6d8[_0x2b2ca9(0x156)]();
            var _0x6cb14f = $(_0x15d6d8['currentTarget']), _0x4b9f1e = this['$']('.invisible_fields'),
                _0x2747f3 = _0x6cb14f[_0x2b2ca9(0x183)]('.list-group-item'),
                _0x285ebf = _0x2747f3['find']('.list-group');
            _[_0x2b2ca9(0x16d)](_0x285ebf, function (_0x240fcc) {
                const _0xf0bd54 = _0x2b2ca9;
                let _0x4596de = $(_0x240fcc);
                0x0 == _0x4596de[_0xf0bd54(0x15f)]('.list-group-item')[_0xf0bd54(0x151)] && (_0x4596de[_0xf0bd54(0x14b)](), _0x4596de['appendTo'](_0x4b9f1e));
            }), _0x2747f3[_0x2b2ca9(0x179)]();
        },
        '_onAddNewGroup': function (_0x195e6c) {
            const _0x5a85f6 = _0x2d26fd;
            _0x195e6c[_0x5a85f6(0x147)](), _0x195e6c[_0x5a85f6(0x156)]();
            var _0x4345a1 = this['$']('.new-group-name');
            let _0x50402e = _0x4345a1[_0x5a85f6(0x17a)]();
            _0x50402e && ($(core[_0x5a85f6(0x18d)][_0x5a85f6(0x17e)]('anita_list.column_group_item', {
                'column': {'name': _0x50402e},
                'widget': this
            }))[_0x5a85f6(0x166)](this['$']('.column_config_container')), _0x4345a1[_0x5a85f6(0x17a)](''), this[_0x5a85f6(0x169)]());
        },
        '_sameAsParent': function (_0x5e770f) {
            const _0x1c1c27 = _0x2d26fd;
            let _0x2a690d = _0x5e770f[_0x1c1c27(0x15d)];
            return !!_0x2a690d && _0x2a690d[_0x1c1c27(0x181)] == _0x5e770f['name'];
        },
        '_reInitNestedSorts': function () {
            const _0x426563 = _0x2d26fd;
            for (let _0x428264 = 0x0; _0x428264 < this[_0x426563(0x167)][_0x426563(0x151)]; _0x428264++) this[_0x426563(0x167)][_0x428264][_0x426563(0x15e)]();
            let _0x2f2db4 = [];
            for (var _0x54a16b = [][_0x426563(0x177)][_0x426563(0x178)](this[_0x426563(0x170)][0x0]['querySelectorAll']('.nested-sortable')), _0xb402fa = 0x0; _0xb402fa < _0x54a16b[_0x426563(0x151)]; _0xb402fa++) {
                let _0x22ac8d = new Sortable(_0x54a16b[_0xb402fa], {
                    'group': 'column_config',
                    'animation': 0x96,
                    'fallbackOnBody': !0x0,
                    'swapThreshold': 0.65,
                    'handle': '.drag_handle'
                });
                _0x2f2db4[_0x426563(0x161)](_0x22ac8d);
            }
            this[_0x426563(0x167)] = _0x2f2db4;
        },
        '_isField': function (_0x35c60d) {
            const _0x27af60 = _0x2d26fd;
            return !_0x35c60d[_0x27af60(0x18e)] || !_0x35c60d[_0x27af60(0x18e)][_0x27af60(0x151)] || (!(!_0x35c60d[_0x27af60(0x14e)] || 'field' == _0x35c60d[_0x27af60(0x14e)]) || !(!this[_0x27af60(0x159)](_0x35c60d) || _0x35c60d['parent']));
        },
        'ensureDelayItems': function (_0x383cd1, _0x808550, _0xaedbfa, _0x5190f7, _0x4a35ac) {
            const _0x25ed45 = _0x2d26fd;
            if (this['$']('.sorter_container')[_0x25ed45(0x149)](), this[_0x25ed45(0x16a)] = _0x383cd1, this['anita_user_data'] = _0x4a35ac, this[_0x25ed45(0x182)] = _0xaedbfa, this['render_invisible_fields'] = _0x5190f7, this[_0x25ed45(0x18b)](), this['header_arch'] = this['header_arch'], !this['isX2Many']) {
                this[_0x25ed45(0x158)] = [];
                for (let _0x43a19f in _0x808550) {
                    let _0x4bcb2e = _[_0x25ed45(0x14f)](_0x808550[_0x43a19f]);
                    _0x4bcb2e[_0x25ed45(0x181)] = _0x43a19f, this['fields'][_0x25ed45(0x161)](_0x4bcb2e);
                }
            }
            this[_0x25ed45(0x188)](), this[_0x25ed45(0x17b)] = $(core[_0x25ed45(0x18d)][_0x25ed45(0x17e)]('anita_list.column_config', {'widget': this})), this[_0x25ed45(0x17b)]['appendTo'](this['$']('.sorter_container')), this[_0x25ed45(0x169)](), this[_0x25ed45(0x175)] = new Sortable(this[_0x25ed45(0x170)][0x0][_0x25ed45(0x14d)]('.invisible_fields'), {
                'group': 'column_config',
                'animation': 0x96,
                'handle': '.drag_handle'
            }), this['$']('#settings')[_0x25ed45(0x149)](), $(core['qweb'][_0x25ed45(0x17e)]('anita_list.settings', {'widget': this}))[_0x25ed45(0x166)](this['$']('#settings'));
        },
        '_postDealHeaderArch': function () {
            let _0x573606 = this['header_arch'];
            _['each'](_0x573606, function (_0xfc895d) {
                const _0x4ba1e2 = a0_0x3439;
                _0xfc895d['children'] && _[_0x4ba1e2(0x16d)](_0xfc895d['children'], function (_0x7506a6) {
                    const _0x25811f = _0x4ba1e2;
                    _0x7506a6[_0x25811f(0x15d)] = _0xfc895d;
                });
            });
        },
        'isHidenFields': function (_0x3ddcca) {
            const _0x14f23c = _0x2d26fd;
            let _0xde8659 = _0x3ddcca[_0x14f23c(0x181)] || _0x3ddcca['attrs'] && _0x3ddcca[_0x14f23c(0x154)][_0x14f23c(0x181)];
            return -0x1 != _[_0x14f23c(0x18a)](this[_0x14f23c(0x182)], function (_0x35a1bd) {
                const _0x246c3c = _0x14f23c;
                return _0x35a1bd[_0x246c3c(0x181)] == _0xde8659 || _0x35a1bd[_0x246c3c(0x154)] && _0x35a1bd['attrs'][_0x246c3c(0x181)] == _0xde8659;
            });
        },
        '_isAllChidrenSame': function (_0x54b317) {
            const _0x498871 = _0x2d26fd;
            let _0x43406b = !0x0, _0x24d679 = _0x54b317[_0x498871(0x18e)];
            for (; _0x24d679 && _0x24d679[_0x498871(0x151)] > 0x0;) {
                if (_0x24d679[_0x498871(0x151)] > 0x1) {
                    _0x43406b = !0x1;
                    break;
                }
                let _0xe63e7c = _0x24d679[0x0];
                if (_0xe63e7c[_0x498871(0x181)] != _0x54b317[_0x498871(0x181)]) {
                    _0x43406b = !0x1;
                    break;
                }
                _0x24d679 = _0xe63e7c[_0x498871(0x18e)];
            }
            return _0x43406b;
        },
        '_getInvisibleColumn': function () {
            const _0x198696 = _0x2d26fd;
            let _0x4c530c = this, _0x9c98d8 = [], _0x266c25 = {};
            _[_0x198696(0x16d)](this[_0x198696(0x16a)], function (_0xca4b17) {
                !function _0x5c371f(_0x5f5122) {
                    const _0x4c9bac = a0_0x3439;
                    let _0x246a5a = _0x5f5122[_0x4c9bac(0x18e)];
                    if (_0x246a5a && 0x0 != _0x246a5a['length']) {
                        for (let _0x47ee9d = 0x0; _0x47ee9d < _0x246a5a[_0x4c9bac(0x151)]; _0x47ee9d++) _0x5c371f(_0x246a5a[_0x47ee9d]);
                    } else _0x9c98d8[_0x4c9bac(0x161)](_0x5f5122);
                }(_0xca4b17);
            }), _[_0x198696(0x16d)](_0x9c98d8, function (_0x6b667b) {
                const _0x5c884b = _0x198696;
                _0x266c25[_0x6b667b['name'] || _0x6b667b[_0x5c884b(0x154)][_0x5c884b(0x181)]] = _0x6b667b;
            });
            let _0x4ed28e = this[_0x198696(0x16b)];
            _[_0x198696(0x16d)](this[_0x198696(0x158)], function (_0x324f7e) {
                const _0x23b22a = _0x198696;
                _0x324f7e[_0x23b22a(0x181)] in _0x4c530c[_0x23b22a(0x182)] || _0x266c25[_0x324f7e[_0x23b22a(0x181)]] || _0x4ed28e[_0x23b22a(0x161)](_0x324f7e);
            }), this[_0x198696(0x164)] = _0x4ed28e;
        },
        '_onTabItemClick': function (_0x4debbd) {
            const _0x1c87df = _0x2d26fd;
            var _0xa59364 = $(_0x4debbd[_0x1c87df(0x15b)]), _0x157f77 = _0xa59364[_0x1c87df(0x16c)]('tab-id');
            this['$']('.tab_item')['removeClass']('active'), _0xa59364[_0x1c87df(0x165)]('active'), this['$']('.tab_content .active')['removeClass']('active'), this['$']('.tab_content #' + _0x157f77)[_0x1c87df(0x165)]('active');
        },
        '_getColumnName': function (_0x131aa7) {
            const _0x9895ac = _0x2d26fd;
            let _0x5beb98 = _0x131aa7[_0x9895ac(0x181)];
            return !_0x5beb98 && _0x131aa7[_0x9895ac(0x154)] && (_0x5beb98 = _0x131aa7[_0x9895ac(0x154)]['name']), _0x5beb98;
        },
        '_getColumnString': function (_0x4d4b5f) {
            const _0x47eee9 = _0x2d26fd;
            let _0x35f26c = _0x4d4b5f[_0x47eee9(0x186)] || _0x4d4b5f['name'];
            return !_0x35f26c && _0x4d4b5f[_0x47eee9(0x154)] && (_0x35f26c = _0x4d4b5f['attrs'][_0x47eee9(0x186)] || _0x4d4b5f[_0x47eee9(0x154)][_0x47eee9(0x181)]), _0x35f26c;
        },
        '_getCurrentColumnConfig': function () {
            const _0x80b57b = _0x2d26fd;
            let _0x2e6d13 = this['$']('.column_config_container .list-group-item'), _0x339202 = [];
            for (let _0x5b7758 = 0x0; _0x5b7758 < _0x2e6d13[_0x80b57b(0x151)]; _0x5b7758++) {
                let _0x6063dd = $(_0x2e6d13[_0x5b7758]);
                if (!(_0x6063dd[_0x80b57b(0x15f)]('.nested-sortable')[_0x80b57b(0x151)] > 0x0)) {
                    let _0x220e0c = _0x6063dd[_0x80b57b(0x15c)]('.list-group-item'), _0x29cae6 = [];
                    for (let _0x3a8691 = 0x0; _0x3a8691 < _0x220e0c[_0x80b57b(0x151)]; _0x3a8691++) {
                        let _0x39572a = $(_0x220e0c[_0x3a8691])[_0x80b57b(0x16c)]('column-name');
                        _0x29cae6[_0x80b57b(0x161)](_0x39572a);
                    }
                    let _0x94001 = _0x6063dd['find']('input'), _0x177d3d = _0x94001[_0x80b57b(0x17a)](),
                        _0x474929 = 0x0;
                    _0x474929 = 'auto' != _0x6063dd[_0x80b57b(0x15f)]('.width_policy')['val']() && _0x94001[_0x80b57b(0x18c)]('column-width');
                    let _0x462742 = _0x6063dd[_0x80b57b(0x15f)]('.toggle_visible')[_0x80b57b(0x155)]('icon-visible'),
                        _0x4addcd = !0x1, _0x3d6530 = !0x1;
                    if (_0x6063dd[_0x80b57b(0x15f)]('.lock_column')[_0x80b57b(0x155)]('icon-lock')) {
                        if (0x0 == _0x339202[_0x80b57b(0x151)]) _0x4addcd = !0x0; else _0x339202[_0x339202['length'] - 0x1][_0x80b57b(0x160)] ? _0x4addcd = !0x0 : _0x3d6530 = !0x0;
                    }
                    let _0x703086 = {
                        'name': _0x6063dd[_0x80b57b(0x16c)]('column-name'),
                        'parent': _0x29cae6[_0x80b57b(0x14c)]('.'),
                        'order': _0x339202['length'] + 0x1,
                        'string': _0x177d3d,
                        'visible': _0x462742,
                        'width': _0x474929,
                        'fixed_left': _0x4addcd,
                        'fixed_right': _0x3d6530
                    };
                    _0x339202[_0x80b57b(0x161)](_0x703086);
                }
            }
            return _0x339202;
        },
        '_getSettings': function () {
            const _0x3a9128 = _0x2d26fd;
            return {
                'has_serials': this['$']('#has_serials')['prop']('checked'),
                'enable_virtual_scroll': this['$']('#enable_virtual_scroll')['prop']('checked'),
                'force_readonly': this['$']('#force_readonly')['prop']('checked'),
                'show_search_row': this['$']('#show_search_row')[_0x3a9128(0x171)]('checked'),
                'border_style': this['$']('#border_style')[_0x3a9128(0x17a)](),
                'enable_anita_list': this['$']('#enable_anita_list')[_0x3a9128(0x171)]('checked'),
                'tree_column': this['$']('#tree_column')[_0x3a9128(0x17a)](),
                'expand_row_template': this['$']('#expand_row_template')[_0x3a9128(0x17a)]()
            };
        },
        '_onSaveColumnConfig': function (_0x1fa703) {
            const _0x1d4666 = _0x2d26fd;
            _0x1fa703[_0x1d4666(0x156)](), _0x1fa703['stopPropagation'](), this[_0x1d4666(0x148)]();
            let _0x457647 = this[_0x1d4666(0x14a)]();
            this[_0x1d4666(0x157)]('anita_list.update_user_settings', {
                'columns': _0x457647,
                'fields': this[_0x1d4666(0x158)],
                'settings': this[_0x1d4666(0x16e)]()
            });
        },
        '_onCancelColumnConfig': function (_0xe128d7) {
            const _0x25e5d1 = _0x2d26fd;
            _0xe128d7['preventDefault'](), _0xe128d7[_0x25e5d1(0x147)](), this[_0x25e5d1(0x148)]();
        },
        '_onToggleVisible': function (_0x5511f1) {
            const _0x3e8f72 = _0x2d26fd;
            let _0x2e2f93 = $(_0x5511f1[_0x3e8f72(0x15b)]);
            _0x2e2f93[_0x3e8f72(0x155)]('icon-visible') ? (_0x2e2f93['removeClass']('icon-visible'), _0x2e2f93['removeClass']('btn-success'), _0x2e2f93['addClass']('icon-invisible'), _0x2e2f93[_0x3e8f72(0x165)]('btn-secondary')) : (_0x2e2f93[_0x3e8f72(0x17f)]('icon-invisible'), _0x2e2f93[_0x3e8f72(0x17f)]('btn-secondary'), _0x2e2f93[_0x3e8f72(0x165)]('icon-visible'), _0x2e2f93[_0x3e8f72(0x165)]('btn-success'));
        },
        'hide': function () {
            const _0x214ad7 = _0x2d26fd;
            this[_0x214ad7(0x170)] && this[_0x214ad7(0x170)][_0x214ad7(0x17f)]('show');
        },
        'show': function () {
            const _0x15fb06 = _0x2d26fd;
            this[_0x15fb06(0x170)][_0x15fb06(0x165)]('show');
        },
        '_onLockColumn': function (_0x322440) {
            const _0x4470b8 = _0x2d26fd;
            let _0x5c8ffe = $(_0x322440[_0x4470b8(0x15b)]);
            _0x5c8ffe[_0x4470b8(0x155)]('icon-lock') ? (_0x5c8ffe[_0x4470b8(0x17f)]('icon-lock'), _0x5c8ffe[_0x4470b8(0x165)]('icon-unlock')) : (_0x5c8ffe['removeClass']('icon-unlock'), _0x5c8ffe['addClass']('icon-lock'));
        },
        '_isFixedColumn': function (_0x37507d) {
            const _0x40a799 = _0x2d26fd;
            return !(!_0x37507d['fixed_left'] && !_0x37507d[_0x40a799(0x150)]);
        },
        '_onResetSettings': function (_0x473298) {
            const _0x149deb = _0x2d26fd;
            this[_0x149deb(0x157)]('anita_list.reset_settings');
        },
        '_getCurrentConfig': function (_0x11fb4d) {
            const _0x29025a = _0x2d26fd;
            if (this['anita_user_data']) return this[_0x29025a(0x173)][_0x11fb4d];
            switch (_0x11fb4d) {
                case'has_serials':
                    return !0x0;
                case'enable_virtual_scroll':
                case'force_readonly':
                    return !0x1;
                case'show_search_row':
                    return !0x0;
                case'border_style':
                    return 'bordered';
                case'enable_anita_list':
                    return !0x0;
            }
        }
    });
});

function a0_0x3439(_0x54a5c8) {
    const tags = a0_0x32ae();
    const temp = function (index) {
        index = index - 327;
        return  tags[index];
    }
    return temp(_0x54a5c8);
}

function a0_0x32ae() {
    return [
        'currentTarget',
        'parents',
        'parent',
        'destroy',
        'find',
        'fixed_left',
        'push',
        '7105710VKhPUW',
        '5459922yvagkU',
        'invisible_fields',
        'addClass',
        'appendTo',
        'nested_sorters',
        '82721ugJQYf',
        '_reInitNestedSorts',
        'header_arch',
        'render_invisible_fields',
        'data',
        'each',
        '_getSettings',
        'extend',
        '$el',
        'prop',
        '757955IiAKjy',
        'anita_user_data',
        'isX2Many',
        'invisible_sorter',
        'then',
        'slice',
        'call',
        'remove',
        'val',
        'column_config',
        '7PfwIaE',
        'state',
        'render',
        'removeClass',
        '985251vZkyTC',
        'name',
        'hidden_fields',
        'closest',
        '8780658PuIgGR',
        '6bwUVhl',
        'string',
        'getParent',
        '_getInvisibleColumn',
        '_rpc',
        'findIndex',
        '_postDealHeaderArch',
        'attr',
        'qweb',
        'children',
        'stopPropagation',
        'hide',
        'empty',
        '_getCurrentColumnConfig',
        'detach',
        'join',
        'querySelector',
        'tag',
        'clone',
        'fixed_right',
        'length',
        '4QVFLGp',
        '527160UjznAw',
        'attrs',
        'hasClass',
        'preventDefault',
        'trigger_up',
        'fields',
        '_isAllChidrenSame',
        '20cTbZlo'
    ];
}