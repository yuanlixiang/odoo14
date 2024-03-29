odoo.define('geely_theme.FavoriteMenu', function (require) {
    "use strict";

    const { Component, misc } = owl;
    const { useRef } = owl.hooks;
    const core = require('web.core');

    const { Portal } = misc;

    class FavoriteMenu extends Component {
        _onMenuClick(menu){
            const action_id = parseInt(menu.action.split(',')[1]);
            this.trigger('menu-click', {action_id, menu_id: menu.id});
        }
        _onDeleteFavorite(menu){
            this.trigger('favorite-menu', {menu_id: menu.id});
        }
    }

    FavoriteMenu.template = 'geely_theme.FavoriteMenu';

    FavoriteMenu.components = { Portal };

    return FavoriteMenu;

});