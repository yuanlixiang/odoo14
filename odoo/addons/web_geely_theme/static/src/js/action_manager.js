odoo.define('geely_theme.ActionManager', function (require) {
    "use strict";

    const ActionManager = require('web.ActionManager');

    ActionManager.include({
        doAction: async function (action, options) {
            await this._super.apply(this, arguments);
            this.trigger_up('toggle_action', {actionId: _.isObject(action) ? action.id : action});
            return action
        },
    });

});