# -*- coding: utf-8 -*-
import time
import hmac
import json
import base64
import datetime
import requests
import locale

from hashlib import sha256
from odoo import api, tools, registry, SUPERUSER_ID
from odoo.tools import config

"""
系统集成-GBOP方式(https://gbop.geely.com/)
核心：验签
"""


class GBOPUtils(object):
    def __init__(self, host, method, path, params, access_key, secret_key, headers=None):
        self.host = host
        self.method = method
        self.path = path
        self.params = params
        self.access_key = access_key
        self.secret_key = secret_key
        self.headers = headers or {}

    def get_resp_data(self, body_data=None, timeout=10, env=None):
        body_data = body_data or {}
        res = None
        if self.method == "GET":
            res = self.get(body_data, timeout)
        elif self.method == "POST":
            # post 请求 Content-type 如在header里未设置，默认为'application/json'
            if not self.headers.get('Content-type'):
                self.headers['Content-type'] = 'application/json'
            res = self.post(body_data, timeout, env)

        return res

    def get(self, body_data=None, timeout=10):
        body_data = body_data or {}
        if body_data:
            body_data = json.dumps(body_data)
        url = self._build_url()
        headers = self._build_headers()

        res = requests.get(url, data=body_data,  headers=headers, timeout=timeout)
        return res

    def post(self, body_data=None, timeout=10, env=None):
        if body_data:
            body_data = json.dumps(body_data)
        url = self._build_url()
        headers = self._build_headers(env)
        res = requests.post(url, data=body_data, headers=headers, timeout=timeout)
        return res

    def _build_url(self):
        query_string = self._build_query_string()
        format_string = "%s%s?%s" if query_string else "%s%s%s"
        url = "http://" + format_string % (self.host, self.path, query_string)
        return url

    def _build_query_string(self):
        query_string = ""
        if not self.params:
            return query_string
        keys = sorted(self.params.keys())
        for k in keys:
            item_string = "%s=%s" % (k, self.params[k])
            query_string = query_string + item_string + "&"
        query_string = query_string.strip("&")
        return query_string

    def _build_headers(self, env=None):
        dbname = config['db_name']
        db_registry = registry(dbname)
        with api.Environment.manage(), db_registry.cursor() as cr:
            # env = api.Environment(cr, SUPERUSER_ID, {})
            if not env:
                env = api.Environment(cr, SUPERUSER_ID, {})
            param_obj = env['ir.config_parameter'].sudo()

            gmt_format = '%a, %d %b %Y %H:%M:%S GMT'
            try:
                locale.setlocale(locale.LC_ALL, param_obj.get_param('locale.locale', default='en_US.UTF-8'))
            except Exception as ER:
                locale.setlocale(locale.LC_ALL, 'english')
            headers = {
                "X-Gapi-Ca-Timestamp": str(int(round(time.time() * 1000))),
                "X-Gapi-Ca-Algorithm": "hmac-sha256",
                "X-Gapi-Ca-Access-Key": self.access_key,
                "X-Gapi-Ca-Signed-Headers": 'X-Gapi-Ca-Timestamp',
                "Date": datetime.datetime.utcnow().strftime(gmt_format),
                "Host": self.host
            }
            # 重置时区
            tools.resetlocale()
            headers["X-Gapi-Ca-Signature"] = self._generate_signature(headers)

            if self.headers:
                headers.update(self.headers)

            return headers

    def _generate_signature(self, headers):
        query_string = self._build_query_string()
        content_array = [self.method, self.path, query_string]
        if headers:
            if headers.__contains__("X-Gapi-Ca-Access-Key"):
                content_array.append(headers["X-Gapi-Ca-Access-Key"])
            if headers.__contains__("Date"):
                content_array.append(headers["Date"])
            if headers.__contains__("X-Gapi-Ca-Signed-Headers"):
                custom_headers = headers["X-Gapi-Ca-Signed-Headers"].split(";")
                for custom_header in custom_headers:
                    content_array.append(custom_header + ":" + headers[custom_header])
        LN = "\n"
        content = LN.join(content_array) + LN
        content = content.encode("utf-8")
        secret_key = self.secret_key.encode("utf-8")
        signature = base64.b64encode(hmac.new(secret_key, content, digestmod=sha256).digest())
        return signature


if __name__ == "__main__":
    pass
