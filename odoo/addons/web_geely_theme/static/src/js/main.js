odoo.define('web.web_client', function (require) {
    "use strict";

    const AbstractService = require('web.AbstractService');
    const env = require('web.env');
    const session = require("web.session");
    const WebClient = require('web.WebClient');
    const config = require('web.config');
    const DeviceSize = require('geely_theme.DeviceSize');

    // configure the env and set it on Owl Component
    owl.config.mode = env.isDebug() ? "dev" : "prod";
    owl.Component.env = env;

    // deploy services in the env
    AbstractService.prototype.deployServices(env);

    // add the owl templates to the environment and start the web client
    const webClient = new WebClient();
    async function startWebClient() {
        await session.is_bound;
        env.qweb.addTemplates(session.owlTemplates);

        await owl.utils.whenReady();
        webClient.setElement($(document.body));
        webClient.$el.toggleClass('disable-sidebar', config.device.size_class <= DeviceSize);
        webClient.start();
    }
    startWebClient();

    return webClient;
});
