# -*- coding: utf-8 -*-
{
    'name': "anita_list",

    'summary': """
        list view extend for odoo, powerfull listview for odoo, advance list manager for odoo!
    """,

    'description': """
    
        list view extend for odoo,
        list view manager,
        list view,
        list manager,
        
        table,
        tree table,
        expaned table,
        editable table,

        fixed table,
        fixed header table,
        fixed footer table,
        fixed header footer table,

        super table,
        advanced table,

        virtual list view,
        virtual list table,
        
        unlimit table,
        advance list manage for odoo,
        greate table
    """,

    'author': "funenc crax",
    'website': "https://odoo.funenc.com",
    'live_test_url': "http://124.223.107.118:8028/",
    'support': "odoo@funenc.com",

    'category': 'Apps/List',
    'version': '14.0.0.2',

    'price': 1999.00,
    'currency': 'EUR',
    'license': 'OPL-1',

    'images': ['static/description/banner.png'],
    'depends': ['base', 'web'],

    'data': [
        'security/ir.model.access.csv',
        'views/anita_web.xml',
        'views/assets.xml',
    ],

    'qweb': [
        'static/xml/anita_list_view.xml',
        'static/xml/anita_list_config.xml',
        'static/xml/anita_search.xml',
        'static/xml/anita_misc.xml',
    ]
}
