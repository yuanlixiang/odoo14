# -*- coding: utf-8 -*-
import operator

from odoo import models, fields, api, tools


class IrUiMenu(models.Model):
    _inherit = 'ir.ui.menu'

    is_favorite = fields.Boolean(compute='_compute_is_favorite')

    def _compute_is_favorite(self):
        """计算菜单是否被当前用户收藏"""
        favorite_menu_ids = self.env.user.favorite_menu_ids.ids  # 当前用户收藏的菜单
        for res in self:
            res.is_favorite = res.id in favorite_menu_ids

    @api.model
    @tools.ormcache_context('self._uid', 'debug', keys=('lang',))
    def load_menus(self, debug):
        """ 增加返回是否收藏 """
        fields = ['name', 'sequence', 'parent_id', 'action', 'web_icon', 'web_icon_data', 'is_favorite']
        menu_roots = self.get_user_roots()
        menu_roots_data = menu_roots.read(fields) if menu_roots else []
        menu_root = {
            'id': False,
            'name': 'root',
            'parent_id': [-1, ''],
            'children': menu_roots_data,
            'all_menu_ids': menu_roots.ids,
        }

        if not menu_roots_data:
            return menu_root

        # menus are loaded fully unlike a regular tree view, cause there are a
        # limited number of items (752 when all 6.1 addons are installed)
        menus = self.search([('id', 'child_of', menu_roots.ids)])
        menu_items = menus.read(fields)

        # add roots at the end of the sequence, so that they will overwrite
        # equivalent menu items from full menu read when put into id:item
        # mapping, resulting in children being correctly set on the roots.
        menu_items.extend(menu_roots_data)
        menu_root['all_menu_ids'] = menus.ids  # includes menu_roots!

        # make a tree using parent_id
        menu_items_map = {menu_item["id"]: menu_item for menu_item in menu_items}
        for menu_item in menu_items:
            parent = menu_item['parent_id'] and menu_item['parent_id'][0]
            if parent in menu_items_map:
                menu_items_map[parent].setdefault(
                    'children', []).append(menu_item)

        # sort by sequence a tree using parent_id
        for menu_item in menu_items:
            menu_item.setdefault('children', []).sort(key=operator.itemgetter('sequence'))

        (menu_roots + menus)._set_menuitems_xmlids(menu_root)

        return menu_root

    def favorite_menu(self, menu_id):
        favorite_menu_ids = self.env.user.favorite_menu_ids.ids
        if menu_id in favorite_menu_ids:
            self.env.user.favorite_menu_ids = [(3, menu_id)]
        else:
            self.env.user.favorite_menu_ids = [(4, menu_id)]

        self.clear_caches()

        return self.env.user.favorite_menu_ids.ids

    # def get_favorite_menu(self):
    #     fields = ['name', 'sequence', 'parent_id', 'action', 'web_icon', 'web_icon_data']
    #     menu_roots = self.env.user.favorite_menu_ids
    #     menu_roots_data = menu_roots.read(fields) if menu_roots else []
    #     menu_root = {
    #         'id': False,
    #         'name': 'root',
    #         'parent_id': [-1, ''],
    #         'children': menu_roots_data,
    #         'all_menu_ids': menu_roots.ids,
    #     }
    #
    #     if not menu_roots_data:
    #         return menu_root
    #
    #     menus = self.search([('id', 'child_of', menu_roots.ids)])
    #     menu_items = menus.read(fields)
    #
    #     menu_items.extend(menu_roots_data)
    #     menu_root['all_menu_ids'] = menus.ids  # includes menu_roots!
    #
    #     menu_items_map = {menu_item["id"]: menu_item for menu_item in menu_items}
    #     for menu_item in menu_items:
    #         parent = menu_item['parent_id'] and menu_item['parent_id'][0]
    #         if parent in menu_items_map:
    #             menu_items_map[parent].setdefault('children', []).append(menu_item)
    #
    #     for menu_item in menu_items:
    #         menu_item.setdefault('children', []).sort(key=operator.itemgetter('sequence'))
    #
    #     (menu_roots + menus)._set_menuitems_xmlids(menu_root)
    #
    #     return menu_root
