odoo.define('geely_theme.Menu', function (require) {
    "use strict";

    const Menu = require('web.Menu');
    const FavoriteMenu = require('geely_theme.FavoriteMenu');
    const { ComponentWrapper } = require('web.OwlCompatibility');
    const core = require('web.core');
    const dom = require('web.dom');
    const local_storage = require('web.local_storage');
    const config = require('web.config');
    const DeviceSize = require('geely_theme.DeviceSize');

    Menu.include({
        events: _.extend({}, Menu.prototype.events, {
            'click .toggle-sidebar': '_onToggleSidebar',
            'click .toggle-home': '_onToggleHomeMenu',
        }),
        init: function (parent, menu_data) {
            this._super.apply(this, arguments);
            const session = this.getSession();
            this.use_favorite_menu = session.use_favorite_menu;
        },

        // 重写
        async start() {
            await this._super(...arguments);
            this._changeSize();
            await this._mountFavoriteMenu();  // 挂载收藏菜单
            config.device.bus.on('size_changed', this, this._changeSize);
        },
        // 重写
        _updateMenuBrand: function (brandName) {
            if(config.device.size_class > DeviceSize){
                return
            }
            return this._super(...arguments)
        },

        _changeSize(){
            this.$('.toggle-sidebar').toggleClass('d-none', config.device.size_class <= DeviceSize);
            this.$('.toggle-favorite').toggleClass('d-none', config.device.size_class <= DeviceSize);

            this.$('.toggle-sidebar').toggleClass('right', !!JSON.parse(local_storage.getItem('side-folded')));
            this.$('.o_menu_brand').toggleClass('d-none', config.device.size_class > DeviceSize);
            this.$('.o_menu_sections').toggleClass('d-none', config.device.size_class > DeviceSize);
        },

        // 重写：设置menuBoard当前项、渲染侧边栏
        change_menu_section: function (primary_menu_id) {
            const current_primary_menu = this.current_primary_menu;
            const menu_sections = this.$menu_sections[primary_menu_id];
            this._super.apply(this, arguments);
            this._changeSidebar(current_primary_menu, menu_sections, primary_menu_id);

        },
        // 切换侧边栏
        _onToggleSidebar(ev){
            ev.preventDefault();
            $(ev.currentTarget).toggleClass('right');
            this.trigger_up('toggle_sidebar');
            local_storage.setItem('side-folded', $(ev.currentTarget).hasClass('right'));
        },
        // 切换主菜单
        _onToggleHomeMenu(ev){
            ev.preventDefault();
            this.trigger_up('toggle_homemenu');
        },
        _changeSidebar(current_primary_menu, menu_sections, primary_menu_id){
            if(!menu_sections || current_primary_menu === primary_menu_id){
                return;
            }

            const menu = _.filter(this.menu_data.children, menu=>menu.id === primary_menu_id)[0];
            this.trigger_up('change_sidebar', {menu});
            this.$('.toggle-sidebar').toggleClass('invisible', menu.children.length === 0);
        },
        // web.client调用
        async toggleFavoriteMenu(menu_id){
            const favorite_menu_ids = await this._rpc({
                model: 'ir.ui.menu',
                method: 'favorite_menu',
                args: [[], menu_id]
            });
            const menu = this.findMenuById(menu_id, this.menu_data);
            menu.is_favorite = !menu.is_favorite;

            await this.FavoriteMenuComponent.update({menuData: _.filter(_.map(favorite_menu_ids, menu_id=>this.findMenuById(menu_id, this.menu_data)), menu=>menu && menu.action)});
            this.trigger_up('toggle_favorite_menu', {menu_id})
        },
        findMenuById: function (menu_id, node) {
            if (node.id === menu_id) {
                return node;
            }
            for (let i = 0; i < node.children.length; i++) {
                const menu = this.findMenuById(menu_id, node.children[i]);
                if (menu) {
                    return menu;
                }
            }
        },
        // 挂载收藏菜单
        async _mountFavoriteMenu(){
            if(!this.use_favorite_menu){
                return
            }
            const session = this.getSession();
            this.FavoriteMenuComponent = new ComponentWrapper(this, FavoriteMenu, {
                menuData: _.filter(_.map(session.favorite_menu_ids, menu_id=>this.findMenuById(menu_id, this.menu_data)), menu=>menu && menu.action)  // 收藏的菜单
            });
            await this.FavoriteMenuComponent.mount(this.el, {position: 'first-child'});
            this.FavoriteMenuComponent.el.addEventListener('menu-click', ev => {
                const {action_id, menu_id} = ev.detail;
                const primary_menu_id = this.action_id_to_primary_menu_id(action_id);
                this.trigger_up('app_clicked', {
                    action_id: action_id,
                    menu_id: primary_menu_id,
                });
                this.$('.toggle-favorite .dropdown-toggle').dropdown('toggle');
            });
            this.FavoriteMenuComponent.el.addEventListener('favorite-menu', ev => {
                const {menu_id} = ev.detail;
                this.toggleFavoriteMenu(menu_id);
                this.$('.toggle-favorite .dropdown-toggle').dropdown('toggle');
            });
        },
    })

});