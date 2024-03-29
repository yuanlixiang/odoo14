odoo.define('geely_widgets.form_widgets', function (require) {
    "use strict";

    var core = require('web.core');


    var LodopReport = function (element, action) {
        var LODOP = getLodop();
        if (!LODOP.PRINT_INIT) {
            return;
        }
        eval(action.params.code);
        LODOP.PREVIEW();
    };

    core.action_registry.add("lodop_report", LodopReport);

});