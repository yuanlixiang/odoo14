# -*- coding: utf-8 -*-
{
    'name': '时间模块',
    'summary': """时间模块""",
    'description': """
        时间模块
    """,
    'author': 'xcz1562020@126.com',
    'website': 'http://odoo.xalife.cn',
    'license ': 'OPL-1',
    'live_test_url': 'http://odoo.xalife.cn',

    'category': 'Hidden/Tools',
    'version': '14.0.1.0.1',
    'application': False,
    'installable': True,
    'auto_install': False,
    'depends': ['web'],

    'data': [
        'data/lang.xml',

        'views/assets.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml',
    ],
    'price': 9.9,
    'currency': 'USD',
    'support': 'xcz1562020@126.com',
}
