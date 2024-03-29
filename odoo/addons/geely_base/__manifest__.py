# -*- coding: utf-8 -*-
{
    'name': "geely_base",

    'summary': """
        1、用户访问报表（用户登录日志，访问日志）
        2、ehr信息获取，员工表扩展
        3、ldap扩展
        4、域账号统一登陆
    """,

    'description': """Geely Base  for odoo 14.0""",

    'author': "hongfei.wu in Geely",
    'website': "http://www.yourcompany.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/14.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'geely基础库/geely基础库',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['web', 'resource', 'hr', 'auth_ldap', 'base'],

    # always loaded
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',

        'data/base_data.xml',
        'data/base_cron.xml',

        'views/views.xml',
        'views/templates.xml',
        'views/base_views.xml',
        'views/res_config.xml',
        # 'views/ir_attachment_views.xml',
        'views/hr_views.xml',
        'views/actions.xml',
        'views/menu.xml',
    ],
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
    'qweb': [
        "static/src/xml/*.xml",
    ],
    'installable': True,
    'auto_install': False,
}
