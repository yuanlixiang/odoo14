odoo.define('geely_base.FormController', function (require) {
    "use strict";

    const FormController = require('web.FormController');
    const BasicModel = require('web.BasicModel');

    // BasicModel.include({
    //     /*
    //     * Form视图切换到edit模式下，onchange应用domain
    //     */
    //     async _editModeOnChange(record){
    //         let { hasOnchange, onchangeSpec } = this._buildOnchangeSpecs(record);
    //         if(!hasOnchange){
    //             return
    //         }
    //
    //         const idList = record.data.id ? [record.data.id] : [];
    //         const ctxOptions = {
    //             full: true,
    //         };
    //
    //         const context = this._getContext(record, ctxOptions);
    //         context.edit_mode_onchange = true;
    //         const currentData = this._generateOnChangeData(record, {
    //             changesOnly: false,
    //             firstOnChange: false,
    //         });
    //         try{
    //             const result = await this._rpc({
    //                 model: record.model,
    //                 method: 'onchange',
    //                 args: [idList, currentData, [], onchangeSpec],
    //                 context,
    //             }).guardedCatch(error=>{
    //                 error.event.preventDefault();
    //                 error.event.stopPropagation();
    //                 error.event.stopImmediatePropagation()
    //             });
    //             if (result && result.domain) {
    //                 record._domains = Object.assign(record._domains, result.domain);
    //             }
    //         }
    //         catch (e){
    //             console.warn(_.str.sprintf('模型：%s切换到Edit模式下，onchange发生错误!'))
    //         }
    //
    //
    //     }
    // });


    // FormController.include({
    //     /*
    //     * Form视图切换到edit模式下，onchange应用domain
    //     */
    //     _setMode: async function (mode, recordID) {
    //         await this._super.apply(this, arguments);
    //         // 不处理用户切换到编辑模式onchange
    //         if(this.modelName !== 'res.users' && this.mode === 'edit' && ! this.model.isNew(this.handle)){
    //             // await this.model._editModeOnChange(this.model.localData[this.handle])
    //         }
    //
    //         return Promise.resolve();
    //     },
    // })

});