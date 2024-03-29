odoo.define('geely_theme.HomeMenu', function (require) {
    "use strict";

    const { Component } = owl;
    const { useRef, useState } = owl.hooks;

    class HomeMenuItem extends Component {

        _onAppClick(){
            this.trigger('menu-board-app-click', {
                action_id: this.props.menu.action.split(',')[1],
                menu_id: this.props.menu.id
            });
        }
    }

    HomeMenuItem.template = 'geely_theme.HomeMenuItem';

    function findNames(memo, menu) {
        if (menu.action) {
            var key = menu.parent_id ? menu.parent_id[1] + "/" : "";
            memo[key + menu.name] = menu;
        }
        if (menu.children.length) {
            _.reduce(menu.children, findNames, memo);
        }
        return memo;
    }

    class HomeMenu extends Component {
        constructor() {
            super(...arguments);
            this.inputRef = useRef('search-input');
            this._searchableMenus = _.reduce(this.props.menuData.children, findNames, {});
            this.state = useState({
                searchResult: []
            });
        }
        toggleHomeMenu(){
            $(this.el).toggleClass('d-none');
            this.trigger('home-menu-toggle', $(this.el).hasClass('d-none'))
        }
        _onInputQuickSearch(){
            const query = this.inputRef.el.value;
            if (query === "") {
                this.state.searchResult = [];
                return;
            }

            let results = fuzzy.filter(query, _.keys(this._searchableMenus), {
                pre: "<b>",
                post: "</b>",
            });
            results = _.map(results, result=>{
                const original = this._searchableMenus[result.original];
                return _.extend(
                    {
                        action_id: parseInt(original.action.split(",")[1], 10),
                    },
                    result,
                    original
                );
            });
            this.state.searchResult = results;
        }
        _onMenuClick(action_id, menu_id){
            this.trigger('menu-click', {
                action_id,
                menu_id
            });
        }
    }

    HomeMenu.template = 'geely_theme.HomeMenu';
    HomeMenu.components = {
        HomeMenuItem
    };

    return HomeMenu;

});