odoo.define('geely_base.many2one', function (require) {
    "use strict";

    const FieldMany2One = require('web.relational_fields').FieldMany2One;
    var core = require('web.core');
    var _t = core._t;
    const { sprintf } = require("web.utils");
    const { escape } = owl.utils;
    const data = require('web.data');

    FieldMany2One.include({
        /*
        * 重写，没有搜索到结果给出'No results to show...'提示
        */
        _search: async function (searchValue = "") {
            const value = searchValue.trim();
            const domain = this.record.getDomain(this.recordParams);
            const context = Object.assign(
                this.record.getContext(this.recordParams),
                this.additionalContext
            );

            // Exclude black-listed ids from the domain
            const blackListedIds = this._getSearchBlacklist();
            if (blackListedIds.length) {
                domain.push(['id', 'not in', blackListedIds]);
            }

            const nameSearch = this._rpc({
                model: this.field.relation,
                method: "name_search",
                kwargs: {
                    name: value,
                    args: domain,
                    operator: "ilike",
                    limit: this.limit + 1,
                    context,
                }
            });
            const results = await this.orderer.add(nameSearch);

            // Format results to fit the options dropdown
            let values = results.map((result) => {
                const [id, fullName] = result;
                const displayName = this._getDisplayName(fullName).trim();
                result[1] = displayName;
                return {
                    id,
                    label: escape(displayName) || data.noDisplayContent,
                    value: displayName,
                    name: displayName,
                };
            });

            // Add "Search more..." option if results count is higher than the limit
            if (this.limit < values.length) {
                values = this._manageSearchMore(values, value, domain, context);
            }
            if (!this.can_create) {
                // "No results" option xichunzhang
                if (!values.length) {
                    values.push({
                        label: _t("No results to show..."),
                    });
                }
                return values;
            }

            // Additional options...
            const canQuickCreate = !this.nodeOptions.no_quick_create;
            const canCreateEdit = !this.nodeOptions.no_create_edit;
            if (value.length) {
                // "Quick create" option
                const nameExists = results.some((result) => result[1] === value);
                if (canQuickCreate && !nameExists) {
                    values.push({
                        label: sprintf(
                            _t(`Create "<strong>%s</strong>"`),
                            escape(value)
                        ),
                        action: () => this._quickCreate(value),
                        classname: 'o_m2o_dropdown_option'
                    });
                }
                // "Create and Edit" option
                if (canCreateEdit) {
                    const valueContext = this._createContext(value);
                    values.push({
                        label: _t("Create and Edit..."),
                        action: () => {
                            // Input value is cleared and the form popup opens
                            this.el.querySelector(':scope input').value = "";
                            return this._searchCreatePopup('form', false, valueContext);
                        },
                        classname: 'o_m2o_dropdown_option',
                    });
                }
                // "No results" option
                if (!values.length) {
                    values.push({
                        label: _t("No results to show..."),
                    });
                }
            } else if (!this.value && (canQuickCreate || canCreateEdit)) {
                // "Start typing" option
                values.push({
                    label: _t("Start typing..."),
                    classname: 'o_m2o_start_typing',
                });
            }

            return values;
        },
    });

});