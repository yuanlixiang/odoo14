odoo.define('nev_widgets.ext_context_freeze_column', function (require) {
    "use strict";

    var FormController = require('web.FormController');
    var ActionManager = require('web.ActionManager');
    var pyUtils = require('web.py_utils');
    var WebClient = require('web.WebClient');
    var ListRenderer = require('web.ListRenderer');
    var session = require('web.session');
    var core = require('web.core');
    let localStorage = require('web.local_storage');
    var qweb = core.qweb;

    WebClient.include({
        custom_events: _.extend({}, WebClient.prototype.custom_events, {
            set_freeze: 'setFreeze',
        }),

        init: function () {
            this._super.apply(this, arguments);
            this.number_of_keep_columns = 0;
            this.arr_offset_lefts = [];
            core.bus.on("DOM_updated", this, this.setFreezePosition.bind(this));
        },

        on_hashchange: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                self.number_of_keep_columns = self._getFreezePositionFromLocalStorage() || 0;
            });
        },

        setFreeze: function (event) {
            this.number_of_keep_columns = (event.data.number_of_keep_columns / 2) + 1;
            this.setFreezePosition();
            this._saveFreezePositionToLocalStorage();
        },

        setFreezePosition: function () {
            this._removeStyle();
            setTimeout(this._setFreezePosition.bind(this), 1000);
        },

        _setFreezePosition: function () {
            var $table = $('.o_list_view .table-responsive');
            if (!$table.length) {
                return
            }

            var wrapper_offset_left = $(".o_content").offset().left;
            var $table_footer = $table.find('tfoot');
            this.arr_offset_lefts.length = 0
            console.log(this.number_of_keep_columns)
            for (var i = 1; i <= this.number_of_keep_columns; i++) {
                var $td = $table_footer.find('td:nth-child(' + i + ')');
                if (!$td.length) {
                    continue
                }
                var offset = $td.offset().left - wrapper_offset_left;
                this.arr_offset_lefts.push(offset)
            }
            this._addStyle()
        },
        _addStyle: function () {
            console.log($(document.head))
            $(document.head).append(
                qweb.render('listview_sticky_header_and_column.style', {
                    arr_offset_lefts: this.arr_offset_lefts
                })
            );
        },
        _removeStyle: function () {
            $('.js_lvs_style').remove();
        },
        _prepareFreezePositionKey: function () {
            return String(this._current_state.action) + '_' +
                String(this._current_state.menu_id) + '_' +
                String(this._current_state.model) + '_' +
                String(this._current_state.view_type);
        },
        _saveFreezePositionToLocalStorage: function () {
            var key = this._prepareFreezePositionKey()
            var value = this.number_of_keep_columns;
            localStorage.setItem(key, value)
        },
        _getFreezePositionFromLocalStorage: function () {
            var key = this._prepareFreezePositionKey()
            return parseInt(localStorage.getItem(key));
        }

    });


    ListRenderer.include({
        _renderHeaderCell: function (node) {
            var cell = this._super.apply(this, arguments);
            var grandpa = this.getParent().getParent();
            if (_.isEmpty(grandpa && grandpa.actions)) {
                return cell;
            }

            var self = this;

            $('<span>', {
                    class: 'display-on-hover js_pin_this_column'
                })
                .html('<i class="fa fa-thumb-tack"></i>')
                .on('click', function (e) {
                    e.stopPropagation();
                    var current_index = $(e.currentTarget)
                        .closest('tr')
                        .find('span')
                        .index(e.currentTarget);

                    self.trigger_up('set_freeze', {
                        number_of_keep_columns: current_index + 1
                    })
                })
                .appendTo(cell);
            return cell;
        },
    });

});