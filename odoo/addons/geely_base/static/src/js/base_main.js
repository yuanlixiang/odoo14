
// datetime弹窗位置
$.fn.datetimepicker.Constructor.prototype._place = function (e){
    var self = e && e.data && e.data.picker || this,
        vertical = self._options.widgetPositioning.vertical,
        horizontal = self._options.widgetPositioning.horizontal,
        parent = void 0;
    var position = (self.component && self.component.length ? self.component : self._element).position(),
        offset = (self.component && self.component.length ? self.component : self._element).offset();
    if (self._options.widgetParent) {
        parent = self._options.widgetParent.append(self.widget);
    } else if (self._element.is('input')) {
        parent = self._element.after(self.widget).parent();
    } else if (self._options.inline) {
        parent = self._element.append(self.widget);
        return;
    } else {
        parent = self._element;
        self._element.children().first().after(self.widget);
    }

    // /!\ ODOO FIX: the 3 next lines have been *added* by odoo
    var parentOffset = parent.offset();
    position.top = offset.top - parentOffset.top;
    position.left = offset.left - parentOffset.left;

    // Top and bottom logic
    if (vertical === 'auto') {
        //noinspection JSValidateTypes
        if (offset.top + self.widget.height() * 1.5 >= $(window).height() + $(window).scrollTop() && self.widget.height() + self._element.outerHeight() < offset.top) {
            vertical = 'top';
        } else {
            vertical = 'bottom';
        }
    }

    // Left and right logic
    if (horizontal === 'auto') {
        // self.widget-->日期拾取器弹窗
        // self._element-->日期输入input
        // offset-->self._element.offset()
        // parent-->body
        // console.log('parent.width: ', parent.width())  // 1916
        // console.log('offset.left: ', offset.left)  // 1757
        // console.log('self.widget.outerWidth: ', self.widget.outerWidth())  // 228
        // console.log('window.width: ', $(window).width())  // 1916
        if (parent.width() < offset.left + self.widget.outerWidth() && offset.left + self.widget.outerWidth() > $(window).width()) {
            horizontal = 'right';
        } else {
            horizontal = 'left';
        }
    }

    if (vertical === 'top') {
        self.widget.addClass('top').removeClass('bottom');
    } else {
        self.widget.addClass('bottom').removeClass('top');
    }

    if (horizontal === 'right') {
        self.widget.addClass('float-right');
    } else {
        self.widget.removeClass('float-right');
    }

    // find the first parent element that has a relative css positioning
    if (parent.css('position') !== 'relative') {
        parent = parent.parents().filter(function () {
            return $(this).css('position') === 'relative';
        }).first();
    }

    if (parent.length === 0) {
        throw new Error('datetimepicker component should be placed within a relative positioned container');
    }

    self.widget.css({
        top: vertical === 'top' ? 'auto' : position.top + self._element.outerHeight() + 'px',
        bottom: vertical === 'top' ? parent.outerHeight() - (parent === self._element ? 0 : position.top) + 'px' : 'auto',
        left: horizontal === 'left' ? (parent === self._element ? 0 : position.left) + 'px' : 'auto',
        right: horizontal === 'left' ? 'auto' : parent.outerWidth() - self._element.outerWidth() - (parent === self._element ? 0 : position.left) + 'px'
    });
};

odoo.define('geely_base.base_main_end', function (require) {
    "use strict";

    const FieldRegistry = require('web.field_registry');
    const FieldChar = require('web.basic_fields').FieldChar;


    //  onchange按钮形式
    var GFieldBtn = FieldChar.extend({
        template: "GFieldBtn",
        init: function () {
            this._super.apply(this, arguments);
            this.btn_title = this.attrs.string || this.string || _t('查询');
        },
        //--------------------------------------------------------------------------
        // Widget API
        //--------------------------------------------------------------------------
        start: function () {
                this._super.apply(this, arguments);
                var self = this
                if(self.mode == 'readonly'){
                     this.$el.find('button').addClass('o_hidden')
                }
                this.$el.find('button').click(function () {
                    if (self.g_searching) {
                        return;
                    }
                    self.g_searching = true;
                    var new_value = self.value == 'a' ? 'b' : 'a';
                    try {
                        self._setValue(new_value);
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
            },
        _renderEdit: function () {
        },
        _renderReadonly: function () {
        },
    });
    FieldRegistry.add('g_field_btn', GFieldBtn);
    //usage:  `<button name="onchange_trigger_field" string="Compute Result" type="object" triggeronchange="trigger_field" />`
    var FormController = require('web.FormController');
    FormController.include({
        _onButtonClicked: function (ev) {
            ev.stopPropagation();
            var self = this;
            var attrs = ev.data.attrs;
            if('triggeronchange' in attrs && self.mode == 'edit'){
                var changes = {[attrs.triggeronchange] : new Date().toString()};
                var value = {
                    dataPointID: self.renderer.allFieldWidgets[self.renderer.state.id][1].dataPointID,
                    viewType: self.renderer.viewType,
                    changes: changes,
                };

                self.renderer.allFieldWidgets[self.renderer.state.id][0].trigger_up('field_changed', value);

                return ;

            }else{
                this._super.apply(this, arguments);
            }
        }
    });


});