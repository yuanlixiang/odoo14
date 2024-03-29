odoo.define('nev_widgets.widget_table_freeze_col', function(require) {
    "use strict";
    var core = require('web.core');
    var fieldRegistry = require('web.field_registry');
    var relational_fields = require('web.relational_fields');
    var basic_fields = require('web.basic_fields');
    var datepicker = require('web.datepicker');
    var qweb = core.qweb;

//    <field widget="table_freeze_col" options="{
//        'number_of_keep_columns': 4,
//        'max_height': 500,
//    }"/>

    var TableFreezeCol = relational_fields.FieldOne2Many.extend({
        init: function () {
            var res = this._super.apply(this, arguments);
            this.offset_left = false;
            return res;
        },
        _render: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function (res) {
                self.$el.find('.table-responsive').css('max-height', '500px').addClass('nev_freeze_class').on('scroll', self._onScrollTable.bind(self));
                self.$el.find('.table-responsive thead th').addClass('sticky_header');
                if (!self.offset_left) {
                    self._setFreezePosition();
                }
                return $.when();
            });
        },
        start: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function (res) {
                core.bus.on('DOM_updated', {}, function (controller) {
                    self._setFreezePosition();
                });
            });
        },
        _onScrollTableTimeout: function () {},
        _onScrollTable: function (event) {
            var self = this;
            clearTimeout(this._onScrollContentTimeout);
            var td_css = { 'background-color': "#FFF", 'z-index': '2', };
            var th_css = { 'background-color': "#EEE", 'z-index': '3', };
            var last_td_css = { 'border-right': '1px solid #ddd', };
            this._onScrollContentTimeout = setTimeout(function () {
                $('.nev_freeze_class tr.o_data_row').each(function(index, row) {
                    var n = self.attrs.options.number_of_keep_columns;
                    for (var i=1; i<=n; i++) {
                        var selector = 'td:nth-child(' + i + ')';
                        var td = $(row).find(selector);
                        $(td).css(td_css).offset({ left: self.offset_left[i-1], });
                        if (i === n) { $(td).css(last_td_css); }
                    }
                    for (var i=1; i<=n; i++) {
                        var selector = '.nev_freeze_class thead tr:nth-child(1) th:nth-child(' + i + ')';
                        var th = $(selector);
                        $(th).css(th_css).offset({ left: self.offset_left[i-1], });
                        if (i === n) { $(th).css(last_td_css); }
                    }
                });
            }, 300);
        },
        _setFreezePosition: function (options) {
            var self = this;
            return this._wrapperScrollContent(function (){
                var $tfoot = $('.nev_freeze_class tfoot');
                if ($tfoot.length === 0)
                    return false;
                var number_of_keep_columns = self.attrs.options.number_of_keep_columns || 3;
                var firstRow = $tfoot;
                var offset_left = [];
                for (var i=1; i<=number_of_keep_columns; i++) {
                    var selector = 'td:nth-child('+i+')';
                    var offset = $(firstRow).find(selector).offset().left;
                    offset_left.push(offset)
                }
                self.offset_left = offset_left;
            });
        },
        _wrapperScrollContent: function(callback) {
            var scrollLeft = $('.nev_freeze_class').scrollLeft();
            $('.nev_freeze_class').scrollLeft(0);
            var res = callback();
            $('.nev_freeze_class').scrollLeft(scrollLeft);
            return res;
        },

    });

    fieldRegistry.add('table_freeze_col', TableFreezeCol);
    return TableFreezeCol;
});