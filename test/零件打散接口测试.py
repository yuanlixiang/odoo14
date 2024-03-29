# -*- coding: utf-8 -*-
# @Time: 2022/6/16 9:32
# -*- coding: utf-8 -*-
import base64
import time
import json
import requests

import base64
import time
import json
import requests
import urllib

# 推送esow包数据
url = "http://127.0.0.1:8071/geely_sda/eps/bom_unfold"
# url = "http://10.34.252.113/geely/partplanning/get_esow_part"
params = {'partNo': ['8888100512']}
header={'content-type':'json'}
response = requests.post(url, headers=header, data=json.dumps(params))



