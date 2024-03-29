# -*- coding: utf-8 -*-

from odoo import models, api, _


class AnitaBaseExtend(models.AbstractModel):
    """
    base extend
    """
    _inherit = "base"


    @api.model
    def load_views(self, views, options=None):
        """ Returns the fields_views of given views, along with the fields of
            the current model, and optionally its filters for the given action.

        :param views: list of [view_id, view_type]
        :param options['toolbar']: True to include contextual actions when loading fields_views
        :param options['load_filters']: True to return the model's filters
        :param options['action_id']: id of the action to get the filters
        :return: dictionary with fields_views, fields and optionally filters
        """
        options = options or {}
        action_id = options.get('action_id')
        self = self.with_context(anita_action_id=action_id)
        return super(AnitaBaseExtend, self).load_views(views, options)


    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        """
        extend to add user data
        """
        result = super(AnitaBaseExtend, self)._fields_view_get(
            view_id, view_type, toolbar, submenu)
        # get the default view id
        if not view_id:
            view_id = result.get('view_id', False)
        if view_type == 'tree' or view_type == 'form':
            self._post_process_user_data(view_id, view_type, result)
        return result

    @api.model
    def _post_process_user_data(self, view_id, view_type, result):
        """
        """
        context = self.env.context
        action_id = context.get('anita_action_id', False)
        user_data = self.env['anita_list.user_data'].get_user_data(
            self._name, action_id, view_id, view_type)
        result["anita_user_data"] = user_data
        
        return result
