odoo.define('geely_theme.SidebarMenu', function (require) {
    "use strict";

    const { Component } = owl;
    const { useState } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const patchMixin = require('web.patchMixin');
    const core = require('web.core');

    const qweb = core.qweb;

    class SidebarMenuItem extends Component {
        constructor() {
            super(...arguments);
            this.state = useState({
                isOpen: false,
                isActive: false,
                isFavorite: this.props.menu.is_favorite
            })
        }
        _onMenuClick(){
            if(this.props.menu.action){
                const action_id = parseInt(this.props.menu.action.split(',')[1]);
                this.trigger('menu-click', {action_id, menu_id: this.props.menu.id});
            }
            else{
                this._closeSibling();
                this.state.isOpen = !this.state.isOpen;
            }
        }
        _onFavoriteMenu(){
//            this.state.isFavorite = !this.state.isFavorite;
            this.trigger('favorite-menu', {menu_id: this.props.menu.id});
        }
//        _onDragStart(ev){
//            ev.dataTransfer.setData('menu_id', this.props.menu.id);
//            this._makeDragIcon(ev.dataTransfer);
//        }
//        // 设置drag时的显示
//        _makeDragIcon(dataTransfer){
//            const $dragIcon = $(qweb.render('geely_theme.dragIcon', {
//                dragIconContent: this.props.menu.name,
//            })).appendTo($('body'));
//            dataTransfer.setDragImage($dragIcon[0], -5, -5);
//
//            setTimeout(() => $dragIcon.remove());
//        }
        // 关闭同胞元素
        _closeSibling(){
            const _owl = this.__owl__;
            const compId = _owl.id;
            _.each(_.keys(_owl.parent.__owl__.children), itemId=>{
                if(parseInt(itemId) !== compId){
                    _owl.parent.__owl__.children[itemId].closeNode()
                }
            });
        }
        // 关闭自身及后代
        closeNode(){
            if(this.state.isOpen){
                this.state.isOpen = false;

                const _owl = this.__owl__;
                _.each(_.keys(_owl.children), itemId=>{
                    _owl.children[itemId].closeNode()
                });
            }
        }
        unActiveNode(){
            this.state.isActive = false;

            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].unActiveNode()
            });
        }
        activeNode(paths, action_id){
            if(paths.includes(this.props.menu.id)){
                this.state.isOpen = true
            }
            if(this.props.menu.action && this.props.menu.action.split(',')[1] === action_id){
                this.state.isActive = true
            }
            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].activeNode(paths, action_id)
            });
        }

        toggleFavorite(menu_id){
            if(this.props.menu.id === menu_id){
                this.state.isFavorite = !this.state.isFavorite;
                return
            }
            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].toggleFavorite(menu_id)
            });
        }

        get classList(){
            const cl = [];
            if(this.state.isOpen){
                cl.push('open')
            }
            if(this.state.isActive){
                cl.push('active')
            }
            return cl.join(' ')
        }
    }
    SidebarMenuItem.template = 'geely_theme.SidebarMenuItem';

    SidebarMenuItem.components = {
        SidebarMenuItem
    };

    class SidebarMenu extends Component {
        constructor() {
            super(...arguments);
            this.isFold = false;  // 是否收拢
            this.currentAction = 0;
            useListener('menu-click', this._onSidebarMenuClick);
        }
        mounted() {
            this._toggleSate()
        }
        patched() {
            this._toggleSate();
            this.toggleAction(this.currentAction);
        }

        _toggleSate(){
            const isFold = this.isFold || (this.props.menu.children && this.props.menu.children.length === 0);
            this.toggleSidebar(isFold);
        }
        // 供外部调用
        toggleSidebar(isFold){
            const $el = $(this.el);
            if(isFold){
                $el.addClass('d-none');
                $el.removeClass('d-flex')
            }
            else{
                $el.removeClass('d-none');
                $el.addClass('d-flex')
            }
        }
        toggleAction(actionId){
            const children = this.props.menu.children;
            if(!children || !children.length){
                return
            }
            const menu = this.props.menu;

            const paths = []  //保存路径
            let count = 0;

            const action_menu_paths = (node)=>{
                paths.push(node.id);
                if (node.action && node.action.split(',')[1] === String(actionId)) {
                    count++;
                }
                for (let i = 0; i < node.children.length; i++){
                    let flag = action_menu_paths(node.children[i]);
                    if(!flag){
                        paths.pop()
                    }
                    else{
                        break
                    }
                }
                return count > 0
            };

            const found = action_menu_paths(menu);
            if(!found){
                return
            }

            this.unActiveMenuItem();

            this.activeMenuItem(paths, String(actionId))
        }
        toggleFavoriteMenu(menu_id){
            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].toggleFavorite(menu_id)
            });
        }
        // todo: 这里有点粗爆
        unActiveMenuItem(){
            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].unActiveNode()
            });
        }
        activeMenuItem(paths, action_id){
            const _owl = this.__owl__;
            _.each(_.keys(_owl.children), itemId=>{
                _owl.children[itemId].activeNode(paths, action_id)
            });
        }

        _onAppClick(){
            if(this.props.menu.action){
                const action_id = parseInt(this.props.menu.action.split(',')[1]);
                this.trigger('sidebar-menu-click', {action_id, menu_id: this.props.menu.id});
            }
        }
        _onSidebarMenuClick({detail: {action_id, menu_id}}){
            this.trigger('sidebar-menu-click', {action_id, menu_id: this.props.menu.id});
        }
    }

    SidebarMenu.template = 'geely_theme.SidebarMenu';

    SidebarMenu.components = {
        SidebarMenuItem
    };

    SidebarMenu.defaultProps = {
        menu: {},
        currentAction: 0,
    };
    SidebarMenu.props = {
        menu: Object,
        currentAction: Number,
        use_favorite_menu: Boolean,
    };

    return patchMixin(SidebarMenu);
});