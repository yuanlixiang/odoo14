odoo.define('geely_theme.WebClient', function (require) {
    "use strict";

    const WebClient = require('web.WebClient');
    const SidebarMenu = require('geely_theme.SidebarMenu');
    const core = require('web.core');
    const { ComponentWrapper } = require('web.OwlCompatibility');
    const session = require('web.session');
    const local_storage = require('web.local_storage');
    const HomeMenu = require('geely_theme.HomeMenu');
    const Menu = require('web.Menu');
    const dom = require('web.dom');
    const config = require('web.config');
    const DeviceSize = require('geely_theme.DeviceSize');

    WebClient.include({
        custom_events: _.extend({}, WebClient.prototype.custom_events, {
            toggle_sidebar: '_onToggleSidebar',
            change_sidebar: '_onChangeSidebar',
            toggle_action: '_onToggleAction',
            toggle_homemenu: '_onToggleHomeMenu',
            toggle_favorite_menu: '_onToggleFavoriteMenu',
        }),

        init: function () {
            this._super.apply(this, arguments);
            this.SidebarProps = {
                isFold: !!JSON.parse(local_storage.getItem('side-folded'))
            };
            const session = this.getSession();
            this.use_favorite_menu = session.use_favorite_menu;
        },

        async start() {
            await this._super.apply(this, arguments);
            config.device.bus.on('size_changed', this, this._onSizeChanged);
        },

        // 重写
        show_application: function () {
            this.set_title();

            return this.menu_dp.add(this.instanciate_menu_widgets()).then(async ()=>{
                $(window).bind('hashchange', self.on_hashchange);
                const state = $.bbq.getState(true);
                if (Object.keys(state).length === 1 && Object.keys(state)[0] === "cids") {
                    const result = await this.menu_dp.add(this._rpc({
                        model: 'res.users',
                        method: 'read',
                        args: [session.uid, ["action_id"]],
                    }));
                    const data = result[0];
                    if (data.action_id) {
                        await this.do_action(data.action_id[0]);
                        this.menu.change_menu_section(this.menu.action_id_to_primary_menu_id(data.action_id[0]));
                    } else {
                        return this.toggleHomeMenu();
                    }
                } else {
                    return this.on_hashchange();
                }
            });
        },

        // 重写
        async on_hashchange(event) {
            if (this._ignore_hashchange) {
                this._ignore_hashchange = false;
                return Promise.resolve();
            }

            var self = this;

            return this.clear_uncommitted_changes().then(function () {
                var stringstate = $.bbq.getState(false);
                if (!_.isEqual(self._current_state, stringstate)) {
                    var state = $.bbq.getState(true);
                    if (state.action || (state.model && (state.view_type || state.id))) {
                        return self.menu_dp.add(self.action_manager.loadState(state, !!self._current_state)).then(function () {
                            if (state.menu_id) {
                                if (state.menu_id !== self.menu.current_primary_menu) {
                                    core.bus.trigger('change_menu_section', state.menu_id);
                                }
                            } else {
                                var action = self.action_manager.getCurrentAction();
                                if (action) {
                                    var menu_id = self.menu.action_id_to_primary_menu_id(action.id);
                                    core.bus.trigger('change_menu_section', menu_id);
                                }
                            }
                        });
                    } else if (state.menu_id) {
                        var action_id = self.menu.menu_id_to_action_id(state.menu_id);
                        return self.menu_dp.add(self.do_action(action_id, {clear_breadcrumbs: true})).then(function () {
                            core.bus.trigger('change_menu_section', state.menu_id);
                        });
                    } else {
                        self.toggleHomeMenu();
                    }
                }
                self._current_state = stringstate;
            }, function () {
                if (event) {
                    self._ignore_hashchange = true;
                    window.location = event.originalEvent.oldURL;
                }
            });
        },

        // 重写
        instanciate_menu_widgets: async function() {
            await this._super(...arguments);
            await this._mountSidebar(); // 挂载侧边菜单栏
            await this._mountHomeMenu();  // 挂载主菜单
        },

        // 挂载主菜单
        async _mountHomeMenu(){
            this.HomeMenuComponent = new ComponentWrapper(this, HomeMenu, {
                menuData: this.menu_data
            });
            await this.HomeMenuComponent.mount(this.$el[0], {position: 'first-child'});
            // 切换主菜单后回调
            this.HomeMenuComponent.el.addEventListener('home-menu-toggle', ev => {
                const action = this.action_manager.getCurrentAction();
                const display = !ev.detail;

                this.$el.toggleClass('home-menu-show', display);
                this.$el.toggleClass('home-menu-first-show', !Boolean(action));

                if(!display){
                    const controller = this.action_manager.getCurrentController();
                    this.current_action_updated(action, controller);
                }
            });
            this.HomeMenuComponent.el.addEventListener('menu-board-app-click', ev => {
                this.trigger_up('app_clicked', {
                    action_id: ev.detail.action_id,
                    menu_id: ev.detail.menu_id,
                });
                this._onToggleHomeMenu(ev)
            });
            this.HomeMenuComponent.el.addEventListener('menu-click', ev => {
                const primary_menu_id = this.menu.action_id_to_primary_menu_id(ev.detail.action_id);
                this.trigger_up('app_clicked', {
                    action_id: ev.detail.action_id,
                    menu_id: primary_menu_id,
                });
                this._onToggleHomeMenu(ev)
            });
        },

        // 显示或隐藏主菜单
        async toggleHomeMenu(){
            const comp = this.HomeMenuComponent.componentRef.comp;
            const hidden = comp.el.classList.contains('d-none');  // 主菜单是否隐藏
            if(hidden){
                await this.clear_uncommitted_changes();

                // 保存当前页面内容
                const $to_detach = this.$el.contents()
                    .not(this.menu.$el)
                    .not('.o_loading')
                    .not('.home-menu')
                    .not('.o_notification_manager')
                    .not('.o_ChatWindowManager');
                this.web_client_content = document.createDocumentFragment();
                dom.detach([{ widget: this.action_manager }], { $to_detach: $to_detach }).appendTo(this.web_client_content);

                this.url = $.bbq.getState();
                if (location.hash) {
                    this._ignore_hashchange = true;
                    $.bbq.pushState('#home', 2);
                }
                $.bbq.pushState({ cids: this.url.cids }, 0);
            }
            else{
                $.bbq.pushState(this.url, 2);
                // 还原页面内容
                dom.append(this.$el, [this.web_client_content], {
                    in_DOM: true,
                    callbacks: [{ widget: this.action_manager }],
                });

                delete this.web_client_content;
            }

            comp.toggleHomeMenu();
        },

        // 挂载侧边菜单栏
        async _mountSidebar(){
            this.SidebarMenuComponent = new ComponentWrapper(this, SidebarMenu, {use_favorite_menu: this.use_favorite_menu});
            await this.SidebarMenuComponent.mount($('.o_action_manager')[0], {position: 'first-child'});
            this.toggleSidebar(this.SidebarProps.isFold);
            this.SidebarMenuComponent.el.addEventListener('sidebar-menu-click', ev => {
                const {action_id, menu_id} = ev.detail;
                this.trigger_up('app_clicked', {
                    action_id,
                    menu_id,
                });
            });
            this.SidebarMenuComponent.el.addEventListener('favorite-menu', ev => {
                const {menu_id} = ev.detail;
                this.menu.toggleFavoriteMenu(menu_id)
            })
        },

        // 修改侧边栏菜单
        async _onChangeSidebar(ev){
            const menu = ev.data.menu;
            await this.SidebarMenuComponent.update({menu});
        },

        // 切换侧边菜单栏
        async _onToggleSidebar(){
            this.SidebarProps.isFold = !this.SidebarProps.isFold;
            this.toggleSidebar(this.SidebarProps.isFold);
            core.bus.trigger('toggle_sidebar', {isFold: this.SidebarProps.isFold});  // 折叠侧边栏后，发送总线消息，以使其他widget可调整相应大小
        },

        // 切换侧边菜单栏
        async toggleSidebar(isFold){
            this.SidebarMenuComponent.componentRef.comp.isFold = isFold;
            this.SidebarMenuComponent.componentRef.comp.toggleSidebar(isFold)
        },

        // 动作切换
        _onToggleAction({data: { actionId }}){
            if(actionId){
                this.SidebarMenuComponent.componentRef.comp.currentAction = actionId;
                this.SidebarMenuComponent.componentRef.comp.toggleAction(actionId)
            }
        },

        // 切换菜单首页
        _onToggleHomeMenu(){
            this.toggleHomeMenu()
        },

        _onToggleFavoriteMenu({data: {menu_id}}){
            this.SidebarMenuComponent.componentRef.comp.toggleFavoriteMenu(menu_id)
        },

        _onSizeChanged(size_class){
            this.$el.toggleClass('disable-sidebar', size_class <= DeviceSize);
        },

    });

});