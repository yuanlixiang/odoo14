/** @odoo-module **/

import {patch} from "web.utils";
import ControlPanelModelExtension from 'web/static/src/js/control_panel/control_panel_model_extension.js';

patch(ControlPanelModelExtension.prototype, "odoo_search_tutorial/static/src/js/search/control_panel_model_extension.js", {
    addMutilAutoCompletionValues(values){
        _.map(values, (value)=>{
            this.addAutoCompletionValues(value);
        })
    },
     deactivateGroupAll() {
        this.state.query =[];
        this._checkComparisonStatus();
     }
});
