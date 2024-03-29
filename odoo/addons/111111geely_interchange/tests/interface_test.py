# -*- coding: utf-8 -*-
import requests
import json
from urllib.parse import unquote

# ESOW获取TREG接口(/sda/treg)测试
# posd_dict = {
#     # 'partnos': ['6608401456', '888811111'],
#     'partnos': ['6608401456', '6608401458', '6608401459', '6608401461', '6608401463'],
# }
url="https://gsda.geely.com/geely_odoo/sda_system/treg"
# url='http://10.240.24.150/geely_odoo/sda_system/treg'
posd_dict = {"partnos": ["6608131998","1016015049","8889898614"]}
try:
    # response = requests.post('http://localhost:8069/sda/treg', data=json.dumps(posd_dict))
    response = requests.get(url, data=json.dumps(posd_dict))
    disposition = response.headers['content-disposition']
    disposition = list(map(str.strip, disposition.split('=')))
    filename = unquote(disposition[-1])
    with open(filename, 'wb') as f:
        f.write(response.content)
except Exception as e:
    print(e)

