odoo.define('geely_theme.FormController', function (require) {
    "use strict";

    require('web.FormController').include({
        saveRecord: async function () {
            const changedFields = await this._super.apply(this, arguments);
            const record = this.model.get(this.handle, { raw: true });
            const context = record.getContext();
            // 从配置中修改个人设置
            if(context.from_my_profile && (changedFields.indexOf('use_favorite_menu') !== -1 ||
            changedFields.indexOf('show_tour_button') !== -1 ||
            changedFields.indexOf('show_help_button') !== -1 || changedFields.indexOf('show_make_help_button') !== -1)){
                this.do_action('reload_context');
            }
            return changedFields;
        },
    })

});