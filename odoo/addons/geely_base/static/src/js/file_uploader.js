odoo.define('geely_base.file_uploader', function (require) {
    "use strict";
    const FileUploader = require('mail/static/src/components/file_uploader/file_uploader.js');
    const Activity = require('mail/static/src/components/activity/activity.js');
    const AttachmentBox = require('mail/static/src/components/attachment_box/attachment_box.js');
    const Composer = require('mail/static/src/components/composer/composer.js');

    class NewFileUploader extends FileUploader{
        async _onAttachmentUploaded(ev, ...filesData) {
            for (const fileData of filesData) {
                const { error, filename, id, mimetype, name, size } = fileData;
                if (error || !id) {
                    this.env.services['notification'].notify({
                        type: 'danger',
                        message: owl.utils.escape(error),
                    });

                    const relatedTemporaryAttachments =
                    this.env.models['mail.attachment'].find(attachment =>attachment.filename === filename && attachment.isTemporary);
                    if(relatedTemporaryAttachments){
                        if(Array.isArray(relatedTemporaryAttachments)){
                            for (const attachment of relatedTemporaryAttachments) {
                                attachment.delete();
                            }
                        }
                        else{
                            relatedTemporaryAttachments.delete()
                        }
                    }

                    return;
                }
                // FIXME : needed to avoid problems on uploading
                // Without this the useStore selector of component could be not called
                // E.g. in attachment_box_tests.js
                await new Promise(resolve => setTimeout(resolve));
                const attachment = this._createAttachment({
                    filename,
                    id,
                    mimetype,
                    name,
                    size,
                });
                this.trigger('o-attachment-created', { attachment });
            }
        }
    }

    Activity.components.FileUploader = NewFileUploader;
    AttachmentBox.components.FileUploader = NewFileUploader;
    Composer.components.FileUploader = NewFileUploader;
});