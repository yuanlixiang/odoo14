# -*- coding: utf-8 -*-
{
    'name': "技术交流平台数据交互",

    'summary': """技术交流平台数据交互""",

    'description': """
技术交流平台数据交互
===============================================
基础数据全量接口
基础数据增量、修改推送
零件数据接口
零件定版接口
    """,
    'category': 'geely工程方案管理平台/geely工程方案管理平台',
    'version': '0.1',

    'depends': ['geely_sda_system'],

    'data': [
        'security/ir.model.access.csv',

        'views/wait_sync_data_view.xml',

        'views/actions.xml',
        'views/menu.xml',

        'data/config_parameter.xml',
        'data/ir_cron.xml',
    ],
    'demo': [
    ],
    'qweb': [
    ],
}