odoo.define('geely_base.field_date', function (require) {
    "use strict";

    const {FieldDate} = require('web.basic_fields')
    FieldDate.include({
        init: function () {
            this._super.apply(this, arguments);
            this.datepickerOptions.widgetPositioning = {
                        horizontal: 'right',
                        vertical: 'auto'
            }
        },
    })
});