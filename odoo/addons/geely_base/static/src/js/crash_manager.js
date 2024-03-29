odoo.define('geely_base.CrashManager', function (require) {
"use strict";
const CrashManager = require('web.CrashManager');
const core = require('web.core');
let active = true;
const _t = core._t;
const ErrorDialogRegistry = require('web.ErrorDialogRegistry');

const ErrorDialog = CrashManager.ErrorDialog;

CrashManager.CrashManager.include({
    init: function () {
        this._super.apply(this, arguments);
        active = true;
    },
    enable: function () {
        active = true;
    },
    disable: function () {
        active = false;
    },
    rpc_error: function(error) {
        // Some qunit tests produces errors before the DOM is set.
        // This produces an error loop as the modal/toast has no DOM to attach to.
        if (!document.body || !active || this.connection_lost) return;

        // Connection lost error
        if (error.code === -32098) {
            this.handleLostConnection();
            return;
        }

        // Special exception handlers, see crash_registry bellow
        var handler = core.crash_registry.get(error.data.name, true);
        if (handler) {
            new (handler)(this, error).display();
            return;
        }

        // Odoo custom exception: UserError, AccessError, ...
        if (_.has(this.odooExceptionTitleMap, error.data.name)) {
            error = _.extend({}, error, {
                data: _.extend({}, error.data, {
                    message: error.data.arguments[0],
                    title: this.odooExceptionTitleMap[error.data.name],
                }),
            });
            this.show_warning(error);
            return;
        }

        // Any other Python exception
        this.show_error(error);
    },
    show_warning: function (error, options) {
        if (!active) {
            return;
        }
        var message = error.data ? error.data.message : error.message;
        var title = _t("Something went wrong !");
        if (error.type) {
            title = _.str.capitalize(error.type);
        } else if (error.data && error.data.title) {
            title = _.str.capitalize(error.data.title);
        }
        return this._displayWarning(message, title, options);
    },
    show_error(error){
        if (!active) {
            return;
        }
        error.traceback = error.data.debug;
        var dialogClass = error.data.context && ErrorDialogRegistry.get(error.data.context.exception_class) || ErrorDialog;
        var dialog = new dialogClass(this, {
            title: _.str.capitalize(error.type) || _t("Odoo Error"),
        }, error);


        // When the dialog opens, initialize the copy feature and destroy it when the dialog is closed
//        var $clipboardBtn;
//        var clipboard;
        dialog.opened(function () {
            // When the full traceback is shown, scroll it to the end (useful for better python error reporting)
            dialog.$(".o_error_detail").on("shown.bs.collapse", function (e) {
                e.target.scrollTop = e.target.scrollHeight;
            });

//            $clipboardBtn = dialog.$(".o_clipboard_button");
//            $clipboardBtn.tooltip({title: _t("Copied !"), trigger: "manual", placement: "left"});
//            clipboard = new window.ClipboardJS($clipboardBtn[0], {
//                text: function () {
//                    return (_t("Error") + ":\n" + error.message + "\n\n" + error.data.debug).trim();
//                },
//                // Container added because of Bootstrap modal that give the focus to another element.
//                // We need to give to correct focus to ClipboardJS (see in ClipboardJS doc)
//                // https://github.com/zenorocha/clipboard.js/issues/155
//                container: dialog.el,
//            });
//            clipboard.on("success", function (e) {
//                _.defer(function () {
//                    $clipboardBtn.tooltip("show");
//                    _.delay(function () {
//                        $clipboardBtn.tooltip("hide");
//                    }, 800);
//                });
//            });
        });
        dialog.on("closed", this, function () {
//            $clipboardBtn.tooltip('dispose');
//            clipboard.destroy();
        });

        return dialog.open();
    }
});

CrashManager.disable = () => active = false;

});