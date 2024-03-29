odoo.define('geely_theme.UserMenu', function (require) {
    "use strict";

    const config = require('web.config');

    require('web.UserMenu').include({
        async start() {
            await this._super(...arguments);
            const session = this.getSession();
            let topbar_name = session.name;
            if (config.isDebug()) {
                topbar_name = _.str.sprintf("%s (%s)", topbar_name, session.db);
            }
            this.$('a').attr('title', topbar_name)
        },
    })

});