# -*- coding: utf-8 -*-
{
    'name': 'Geely Theme',
    'summary': 'Geely Theme',
    'version': '14.0.1.0.1',
    'author': '675938238@qq.com',
    'license': 'LGPL-3',
    'installable': True,
    'depends': ['web'],
    'data': [
        'views/assets.xml',

        'views/users_view.xml',
        'views/webclient_template.xml',
        'views/res_config_settings_views.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml'
    ],
    'sequence': 1,
}
