odoo.define('geely_base.access_log', function (require) {
    "use strict";

    const WebClient = require('web.WebClient');
    const ActionManager = require('web.ActionManager');
    const core = require('web.core');
    require('web.ActWindowActionManager');

    ActionManager.include({
        _handleAction: function (action, options) {
            if(action.type !== 'ir.actions.act_window_close' && action.res_model !== 'geely.users.access.log'){
                core.bus.trigger('g_menu_action', {options: {action_id: action.id}});
            }
            return this._super.apply(this, arguments);

        }
    });


    WebClient.include({
        start: function () {
            core.bus.on('g_menu_action', this, this.g_menu_action);
            return this._super.apply(this, arguments);
        },
        g_menu_action: function ({options}) {
            if (options.action_id) {
                this._rpc({
                    route: '/web/geely/access/log',
                    params: {action_id: options.action_id}
                }).then((result)=>{}).catch((error)=>{})
            }
        }
    });
});


odoo.define('geely_base.access_log_report', function (require) {
    "use strict";

    const AbstractAction = require('web.AbstractAction');
    const ajax = require('web.ajax');
    const core = require('web.core');

    const AccessLogReport = AbstractAction.extend({
        contentTemplate: 'geely_base.AccessLogTemp',
        jsLibs: [
            '/web/static/lib/Chart/Chart.js',
        ],
        events : {
            "click button.month-users" : "_onMonthUsersChooseMonth",
            "click button.date-module" : "_onDateModuleChooseDate",
            "click button.month-module" : "_onMonthModuleChooseMonth",
        },
        init(parent, action) {
            this._super.apply(this, arguments);
            // 当前月份
            const today = moment().format('YYYY-MM-DD');
            const first_date = moment().format('YYYY-MM-01');
            const last_date = moment(first_date).add(1, 'M').add(-1, 'd').format('YYYY-MM-DD');

            // 以月为周期，统计日活跃用户
            this.month_users = {
                first_date,
                last_date
            };
            // 以天为周期，统计每个模块的访问量
            this.date_module = {
                date: today
            };
            // 以月为周期，统计每个模块的访问量
            this.month_module = {
                first_date,
                last_date
            };
        },
        async willStart(){
            await this._super(...arguments);
            // 获取所有图形数据
            this.all_data  = await this._getGraphData({
                method: 'allData',
                date_range: {
                    month_users: this.month_users,
                    date_module: this.date_module,
                    month_module: this.month_module
                }
            });
        },
        on_attach_callback: function () {
            // 日活跃用户
            this.chartMonthUsers = this._renderInDOM(this.$('.access-log-month-users'), this.all_data.month_users, "日活跃用户", '日期', '用户数');
            this._renderMonthUsersButton();

            this.chartDateModule = this._renderInDOM(this.$('.access-log-date-module'), this.all_data.date_module, '日模块访问量', '模块', '访问量');
            this._renderDateModuleButton();

            this.chartMonthModule = this._renderInDOM(this.$('.access-log-month-module'), this.all_data.month_module, '月模块访问量', '模块', '访问量');
            this._renderMonthModuleButton();
        },
        _onMonthUsersChooseMonth(event){
            this._doAction('geely.choose.month.wizard', this._onMonthUsersChooseMonthCallBack.bind(this), '选择月份', event,
            {default_month: this.month_users.first_date})
        },
        _onDateModuleChooseDate(event){
            this._doAction('geely.choose.date.wizard', this._onDateModuleChooseDateCallBack.bind(this), '选择日期', event,
            {default_date: this.date_module.date})
        },
        _onMonthModuleChooseMonth(event){
            this._doAction('geely.choose.month.wizard', this._onMonthModuleChooseMonthCallBack.bind(this), '选择月份', event,
            {default_month: this.month_module.first_date})
        },
        _doAction(model, closeCallBack, title, event, context={}){
            return this.do_action({
                name: title,
                type: 'ir.actions.act_window',
                res_model: model,
                target: 'new',
                views: [[false, 'form']],
                context
            },
            {
                on_close: options=>{
                    _.extend(options || {}, {event});
                    closeCallBack(options)
                }
            });
        },
        async _onMonthUsersChooseMonthCallBack(options){
            if(!options){
                return
            }
            const {special, month, event} = options;
            if(special){
                return
            }
            if(moment(this.month_users.first_date).isSame(moment(month))){
                return
            }
            const first_date = month;
            const last_date = moment(month).add(1, 'M').add(-1, 'd').format('YYYY-MM-DD');
            const result  = await this._getGraphData({
                method: 'monthUsers',
                date_range: {
                    month_users: {
                        first_date,
                        last_date
                    },
                }
            });
            this.month_users.first_date = month;
            this._renderMonthUsersButton();
            this.chartMonthUsers.data = result.month_users.data;
            this.chartMonthUsers.update()
        },
        async _onDateModuleChooseDateCallBack(options){
            if(!options){
                return
            }
            const {special, date, event} = options;

            if(special){
                return
            }
            if(moment(this.date_module.date).isSame(moment(date))){
                return
            }
            const result  = await this._getGraphData({
                method: 'dateModule',
                date_range: {
                    date_module: {
                        date
                    },
                }
            });
            this.date_module.date = date;
            this._renderDateModuleButton();
            this.chartDateModule.data = result.date_module.data;
            this.chartDateModule.update()
        },
        async _onMonthModuleChooseMonthCallBack(options){
            if(!options){
                return
            }
            const {special, month, event} = options;

            if(special){
                return
            }
            if(moment(this.month_module.first_date).isSame(moment(month))){
                return
            }
            const first_date = month;
            const last_date = moment(month).add(1, 'M').add(-1, 'd').format('YYYY-MM-DD');
            const result  = await this._getGraphData({
                method: 'monthModule',
                date_range: {
                    month_module: {
                        first_date,
                        last_date
                    },
                }
            });
            this.month_module.first_date = month;
            this._renderMonthModuleButton();
            this.chartMonthModule.data = result.month_module.data;
            this.chartMonthModule.update();
        },
        _renderMonthUsersButton(){
            this.$('button.month-users').text(moment(this.month_users.first_date).format('YYYY-MM'))
        },
        _renderDateModuleButton(){
            this.$('button.date-module').text(moment(this.date_module.date).format('YYYY-MM-DD'))
        },
        _renderMonthModuleButton(){
            this.$('button.month-module').text(moment(this.month_module.first_date).format('YYYY-MM'))
        },
        // renderer Chart
        _renderInDOM($el, config, title='', x_title='Title', y_title=''){
            _.extend(config, {
                options:{
                    maintainAspectRatio: false,

                    legend: {display: false},
                    title: {display: true, text: title},
                    scales: {
                        xAxes: [{
                            type: 'category',
                            scaleLabel: {
                                display: true,
                                labelString: x_title,
                            },
                            ticks: {
                                callback: function (label) {
                                    return label
                                },
                            },
                        }],
                        yAxes: [{
                            type: 'linear',
                            scaleLabel: {
                                display: true,
                                labelString: y_title,
                            },
                            ticks: {
                                callback: (label)=>{
                                    return label
                                },
                                suggestedMax: 0,
                                suggestedMin: 0,
                            }
                        }],
                    },

                    tooltips: {
                        intersect: false,
                        position: 'nearest',
                        caretSize: 0,
                    },
                    elements: {
                        rectangle: {
                            borderWidth: 1
                        }
                    },
                }
            });
            const $canvas = $('<canvas style="width:auto;height:100%"/>');
//            $el.empty();
            $el.append($canvas);
            const context = $canvas[0].getContext('2d');
            return new Chart(context, config);
        },

        async _getGraphData(params){
            return await this._rpc({
                model: 'geely.users.access.log',
                method: 'get_graph_data',
                args: [[]],
                kwargs: params,
            });
        },
    });
    core.action_registry.add('access_log_report', AccessLogReport);

    return AccessLogReport;
});

