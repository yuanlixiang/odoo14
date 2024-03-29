# -*- encoding: utf-8 -*-

import odoo
import requests
from odoo import http, SUPERUSER_ID
from odoo import api, fields, models, _
from odoo.http import request
from odoo.addons.web.controllers.main import Home, Session, Binary, ensure_db
from ..models.encryption import get_aes_key, get_rsa_key, rsa_decrypt
from ..models.img_code import get_img_code
from odoo.exceptions import AccessError, UserError, AccessDenied
from odoo.addons.web.controllers.main import clean
import json
import urllib.request
import requests
from odoo.models import fix_import_export_id_paths
import xlsxwriter
import datetime
from io import StringIO
import pytz
from lxml import etree
import werkzeug
import requests
from urllib import parse
import operator
import re
import logging
import unicodedata
import base64
from odoo.addons.geely_base.models.exceptions import UploadExtError

_logger = logging.getLogger(__name__)

# fix http redirect
redirect_urls = [
    '10.86.87.180',
    '10.190.37.184',
    '10.190.35.122',
    'geely-uc-sso-protocol-restful.prod.app-cloud.geely.com',
    'geely-uc-sso-protocol-restful.app.dev01.geely.ocp',
    'geely-uc-sso-protocol-restful.sgw.geely.svc',
    'passport.geely.com',
    '10.190.35.122',
    'passport-pre.geely.com',
    'passport-test.test.geely.com',
    'gcms.geely.com',
    '10.86.219.12',
    '10.86.219.13',
    '10.86.219.14',
    '127.0.0.1',
    'sda.geely.com',
    '10.24.24.160',
    '10.240.24.150',
    '10.240.24.150:8069',
    '10.240.24.150:8088',
    'gimp.geely.com',
    'gbop.geely.com',
    'www.baidu.com'
]

old_redirect = werkzeug.utils.redirect


def new_redirect(location, code=302, Response=None):
    if type(location) != str:
        location = location.path
    if not location.startswith('/') and parse.urlparse(location).hostname not in redirect_urls:
        location = '/'
    return old_redirect(location, code, Response)


werkzeug.utils.redirect = new_redirect


def redirect_with_hash(url, code=303):
    # Most IE and Safari versions decided not to preserve location.hash upon
    # redirect. And even if IE10 pretends to support it, it still fails
    # inexplicably in case of multiple redirects (and we do have some).
    # See extensive test page at http://greenbytes.de/tech/tc/httpredirects/
    _logger.warning('--------info: %s -----------' % url)
    if not url.startswith('/') and parse.urlparse(url).hostname not in redirect_urls:
        url = '/'
    if request.httprequest.user_agent.browser in ('firefox',):
        return werkzeug.utils.redirect(url, code)
    url = url.replace("'", "%27").replace("<", "%3C")
    return "<html><head><script>window.location = '%s' + location.hash;</script></head></html>" % url


http.redirect_with_hash = redirect_with_hash


class NewHome(Home):


    def local_redirect_passport(self, redirect=None):
        """跳转至统一登陆界面"""
        param_obj = request.env['ir.config_parameter'].sudo()
        if param_obj.get_param('geely_base.sso_auto_login') == 'on':
            sso_login_url = param_obj.get_param('geely_base.sso_login_url')
            appKey = param_obj.get_param('geely_base.sso_appKey')
            sso_redirect = redirect if redirect else param_obj.get_param('geely_base.sso_redirect')  # 验证后的跳转地址 /
            # sso_url = '%s/html/?appKey=%s&redirectUrl=%s' % (sso_login_url, appKey, sso_redirect)
            sso_url = '%s/?appKey=%s&redirectUrl=%s' % (sso_login_url, appKey, sso_redirect)
            return http.local_redirect(sso_url)

    @http.route('/', type='http', auth="none")
    def index(self, s_action=None, db=None, **kw):
        if not request.session.uid:
            port = request.httprequest.headers.get('Host-Real-Port')
            if port != '8069':
                redirect_passport = self.local_redirect_passport()
                if redirect_passport:
                    return redirect_passport
        return super(NewHome, self).index(s_action, db, **kw)

    @http.route('/web', type='http', auth="none")
    def web_client(self, s_action=None, **kw):
        if not request.session.uid:
            redirect_passport = self.local_redirect_passport()
            if redirect_passport:
                return redirect_passport
            return werkzeug.utils.redirect('/web/login', 303)
        if kw.get('redirect'):
            return werkzeug.utils.redirect(kw.get('redirect'), 303)
        debug = kw.get('debug', False) if 'debug' in kw.keys() else False
        user_id = request.context.get('uid', False)
        if debug or debug == '':
            if user_id:
                user = request.env['res.users'].sudo().browse(user_id)
                if not user.has_group('geely_base.group_debug_mode_enable'):
                    return werkzeug.utils.redirect('/web/login?error=access')
        return super(NewHome, self).web_client(s_action=s_action, **kw)

    @http.route('/web/login', type='http', auth="none")
    def web_login(self, redirect=None, **kw):
        if request.httprequest.method == 'POST':
            request.params['password'] = rsa_decrypt(request.session.rsa_key, request.params['password'])
        request.session.rsa_public_key, request.session.rsa_key = get_rsa_key()
        request.get_img_code = get_img_code
        if request.session.get('retry_count') is None:
            request.session.retry_count = 0
        if request.httprequest.method == 'POST' and request.session.retry_count > 4 and (
                request.params['img_code'] or '').lower() != request.session.img_code.lower():
            param_obj = request.env['ir.config_parameter'].sudo()
            request.params['background_src'] = param_obj.get_param('login_form_background_default') or ''
            values = request.params.copy()
            try:
                values['databases'] = http.db_list()
            except odoo.exceptions.AccessDenied:
                values['databases'] = None
            values['error'] = _(u'错误的验证码')
            request.session.img_code = get_aes_key(4)
            return request.render('web.login', values)
        request.session.img_code = get_aes_key(4)
        res = super(NewHome, self).web_login(redirect, **kw)
        if not request.params['login_success']:
            request.session.retry_count += 1
        else:
            request.session.rsa_public_key = ''
            request.session.rsa_key = ''
            request.session.retry_count = 0
        try:
            remote_addr = request.httprequest.remote_addr or ''
            if remote_addr in ['172.17.0.1', '127.0.0.1']:
                remote_addr = request.httprequest.headers.get('X-Real-IP') or ''
            if request.params['login_success']:
                request.env['geely.users.login.log'].sudo().create({
                    'user_id': request.uid,
                    'operation': u'登录',
                    'remote_addr': remote_addr
                })
        except:
            pass
        return res

    @http.route('/geely/refresh/code', type='http', auth="none")
    def g_refresh_code(self, **kw):
        code = get_aes_key(4)
        request.session.img_code = code
        return 'data:image/png;base64,%s' % get_img_code(code)

    @http.route('/web/geely/access/log', type='json', auth='user')
    def web_geely_access_log(self, action_id, **kw):
        try:
            remote_addr = request.httprequest.remote_addr or ''
            if remote_addr in ['172.17.0.1', '127.0.0.1']:
                remote_addr = request.httprequest.headers.get('X-Real-IP') or ''
            request.env.cr.execute("""INSERT INTO geely_users_access_log (create_uid,write_uid,create_date,write_date,user_id,actions_id,remote_addr)
                                              VALUES (%s,%s,(now() at time zone 'UTC'),(now() at time zone 'UTC'),%s,%s,'%s') RETURNING id;"""
                                   % (SUPERUSER_ID, SUPERUSER_ID, request.uid, action_id, remote_addr))
        except Exception as e:
            pass
        return ''

    def geely_sso_session(self, token, redirect='/', show_params=True):
        try:
            param_obj = request.env['ir.config_parameter'].sudo()
            sso_url = param_obj.get_param('geely_base.sso_url')
            appKey = param_obj.get_param('geely_base.sso_appKey')
            url = '%s/session-info-new/%s?appKey=%s' % (sso_url, token, appKey)
            _logger.warning('-----1---info: %s -----------' % url)
            print('--------info: %s -----------' % url)
            data = requests.get(url)
            _logger.warning('-----2---data: %s -----------' % data)
            _logger.warning('------2--data.content: %s -----------' % data.content)
            _logger.warning('------2-json-data.content: %s -----------' % json.loads(data.content))

            content = json.loads(data.content)
            _logger.warning('------2--content: %s -----------' % content)
            info = content['data']
            _logger.warning('-----3---info: %s -----------' % info)
            print('--------info: %s -----------' % info)
            if info:
                uid, login = request.env['res.company.ldap'].sudo().g_sso_get_or_create_user(info)
                _logger.warning('--------uid: {} login:{} -----------'.format(uid, login))
                print('--------uid: {} login:{} -----------'.format(uid, login))
                request.session.g_login_checked = 1
                request.session.password = token
                request.session.authenticate(request.session.db, login, token)
                if show_params:
                    return http.local_redirect(redirect, query=request.params, keep_hash=True)
                else:
                    return http.local_redirect(redirect, keep_hash=True)
        except Exception as e:
            _logger.warning('----------------------------sso session failed: %s' % str(e))
        if hasattr(request.session, 'g_login_checked'):
            request.session.g_login_checked = 0
            request.session.password = None
        return http.local_redirect('/web/login', query={'redirect': redirect}, keep_hash=True)

    @http.route('/c3/home', type='http', auth='none', csrf=False)
    def c3_home(self, **kw):
        # self.ensure_db()
        token = kw.get('token')
        # _logger.warn('````````````````````````````````token: %s' % str(token))
        uid = request.session.uid
        # home_page = '/geely_apps/timesheet/home'
        home_page = '/c3/apps'
        if uid and (not token or request.session.password == token):
            return http.local_redirect(home_page, keep_hash=True)
        if not token:
            return http.local_redirect('/web/login', query=request.params, keep_hash=True)
        else:
            return self.geely_sso_session(token, redirect=home_page)

    # 现在只有一个模块工时，直接跳转到工时，增加app后跳转到app列表 大图标
    @http.route('/c3/apps', type='http', auth='none', csrf=False)
    def c3_apps(self, **kw):
        return request.render('geely_mobile.c3_apps', {})

    @http.route('/geely/home', type='http', auth='none', csrf=False)
    def geely_home(self, **kw):
        _logger.warning('````````````````````````````````kw: %s' % str(kw))
        uid = request.session.uid
        if uid:
            return http.local_redirect('/', keep_hash=True)
        else:
            param_obj = request.env['ir.config_parameter'].sudo()
            sso_login_url = param_obj.get_param('geely_base.sso_login_url')
            appKey = param_obj.get_param('geely_base.sso_appKey')
            sso_redirect = param_obj.get_param('geely_base.sso_redirect')  # 验证后的跳转地址
            sso_url = '%s/html/?appKey=%s&redirectUrl=%s' % (sso_login_url, appKey, sso_redirect)
            return http.local_redirect(sso_url)

    @http.route('/sso', type='http', auth='none', csrf=False)
    def geely_sso(self, **kw):
        # self.ensure_db()
        _logger.warning('````````````````````````````````kw: %s' % str(kw))
        token = kw.get('ticket') or ''
        redirectUrl = kw.get('redirectUrl') or '/'
        _logger.warning('````````````````````````````````token: %s' % str(token))
        uid = request.session.uid
        if uid and (not token or request.session.password == token):
            return http.local_redirect('/', keep_hash=True)
        if not token:
            return http.local_redirect('/web/login', keep_hash=True)
        else:
            return self.geely_sso_session(token, redirect=redirectUrl, show_params=False)

    @http.route('/geely/lange/change', type='json', auth="user")
    def geely_lange_change(self, lang, **kw):
        request.env.user.write({'lang': lang})
        return {
            'type': 'ir.actions.client',
            'tag': 'reload_context',
        }


class NewSession(Session):
    @http.route('/web/session/change_password', type='json', auth="user")
    def change_password(self, fields):
        old_password, new_password, confirm_password = operator.itemgetter('old_pwd', 'new_password', 'confirm_pwd')(
            dict(map(operator.itemgetter('name', 'value'), fields)))
        if len(new_password) < 8 or not re.search("^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).*$", new_password):
            raise UserError(_(u'密码不符合复杂性要求：长度必需大于8位，并且包含大写字母、小写字母、数字和特殊字符'))
        return super(NewSession, self).change_password(fields)

    @http.route('/web/session/logout', type='http', auth="none")
    def logout(self, redirect='/web'):
        if hasattr(request.session, 'g_login_checked') and request.session.g_login_checked:
            ticket = request.session.password
            request.session.logout(keep_db=True)
            param_obj = request.env['ir.config_parameter'].sudo()
            sso_url = param_obj.get_param('geely_base.sso_url')
            url = '%s/invalidate/%s' % (sso_url, ticket)
            data = requests.delete(url)
            if data.status_code == 200:
                app_key = param_obj.get_param('geely_base.sso_appKey')
                sso_redirect = param_obj.get_param('geely_base.sso_redirect')
                sso_login_url = param_obj.get_param('geely_base.sso_login_url')
                sso_url = '%s/?appKey=%s&redirectUrl=%s' % (sso_login_url, app_key, sso_redirect)
                _logger.info('`````logout success````````')
                return http.local_redirect(sso_url)
        request.session.logout(keep_db=True)
        return super(NewSession, self).logout(redirect)


class NewBinary(Binary):
    """重写upload和upload_attachment方法，限制可上传文件的类型"""

    @http.route()
    def upload_attachment(self, model, id, ufile, callback=None):
        """上传附件创建ir.attachment时，增加上下文upload_attachment，以在校验ir.attachment的name字段时加以区分"""
        files = request.httprequest.files.getlist('ufile')
        Model = request.env['ir.attachment']
        out = """<script language="javascript" type="text/javascript">
                    var win = window.top.window;
                    win.jQuery(win).trigger(%s, %s);
                </script>"""
        args = []
        for ufile in files:

            filename = ufile.filename
            if request.httprequest.user_agent.browser == 'safari':
                # Safari sends NFD UTF-8 (where é is composed by 'e' and [accent])
                # we need to send it the same stuff, otherwise it'll fail
                filename = unicodedata.normalize('NFD', ufile.filename)

            try:
                attachment = Model.create({
                    'name': filename,
                    'datas': base64.encodebytes(ufile.read()),
                    'res_model': model,
                    'res_id': int(id)
                })
                attachment._post_add_create()
            except UploadExtError:
                request._cr.rollback()
                args.append({'error': '禁止上传的文件类型', 'filename': filename})
            except Exception:
                request._cr.rollback()
                args.append({'error': _("Something horrible happened")})
                _logger.exception("Fail to upload attachment %s" % ufile.filename)
            else:
                args.append({
                    'filename': clean(filename),
                    'mimetype': ufile.content_type,
                    'id': attachment.id,
                    'size': attachment.file_size
                })
        return out % (json.dumps(clean(callback)), json.dumps(args)) if callback else json.dumps(args)

