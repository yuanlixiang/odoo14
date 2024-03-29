# -*- coding: utf-8 -*-
import datetime
import json
import logging
import random
import select
import threading
import time

import odoo
from odoo import api, fields, models, SUPERUSER_ID
from odoo.tools.misc import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.tools import date_utils

_logger = logging.getLogger(__name__)

# longpolling timeout connection
TIMEOUT = 50

#----------------------------------------------------------
# Bus
#----------------------------------------------------------
def json_dump(v):
    return json.dumps(v, separators=(',', ':'), default=date_utils.json_default)

def hashable(key):
    if isinstance(key, list):
        key = tuple(key)
    return key


class ImBus(models.Model):

    _name = 'bus.bus'
    _description = 'Communication Bus'

    channel = fields.Char('Channel')
    message = fields.Char('Message')

    @api.autovacuum
    def _gc_messages(self):
        timeout_ago = datetime.datetime.utcnow()-datetime.timedelta(seconds=TIMEOUT*2)
        domain = [('create_date', '<', timeout_ago.strftime(DEFAULT_SERVER_DATETIME_FORMAT))]
        return self.sudo().search(domain).unlink()

    @api.model
    def sendmany(self, notifications):
        channels = set()
        for channel, message in notifications:
            channels.add(channel)
            values = {
                "channel": json_dump(channel),
                "message": json_dump(message)
            }
            self.sudo().create(values)
        if channels:
            # We have to wait until the notifications are commited in database.
            # When calling `NOTIFY imbus`, some concurrent threads will be
            # awakened and will fetch the notification in the bus table. If the
            # transaction is not commited yet, there will be nothing to fetch,
            # and the longpolling will return no notification.
            @self.env.cr.postcommit.add
            def notify():
                with odoo.sql_db.db_connect('postgres').cursor() as cr:
                    cr.execute("notify imbus, %s", (json_dump(list(channels)),))

    @api.model
    def sendone(self, channel, message):
        self.sendmany([[channel, message]])

    @api.model
    def poll(self, channels, last=0, options=None):
        if options is None:
            options = {}
        # first poll return the notification in the 'buffer'
        if last == 0:
            timeout_ago = datetime.datetime.utcnow()-datetime.timedelta(seconds=TIMEOUT)
            domain = [('create_date', '>', timeout_ago.strftime(DEFAULT_SERVER_DATETIME_FORMAT))]
        else:  # else returns the unread notifications
            domain = [('id', '>', last)]
        channels = [json_dump(c) for c in channels]
        domain.append(('channel', 'in', channels))
        notifications = self.sudo().search_read(domain)
        # list of notification to return
        result = []
        for notif in notifications:
            result.append({
                'id': notif['id'],
                'channel': json.loads(notif['channel']),
                'message': json.loads(notif['message']),
            })
        return result


#----------------------------------------------------------
# Dispatcher
#----------------------------------------------------------
class ImDispatch(object):
    def __init__(self):
        self.channels = {}
        self.started = False

    def poll(self, dbname, channels, last, options=None, timeout=TIMEOUT):
        if options is None:
            options = {}
        # Dont hang ctrl-c for a poll request, we need to bypass private
        # attribute access because we dont know before starting the thread that
        # it will handle a longpolling request
        if not odoo.evented:
            current = threading.current_thread()
            current._daemonic = True
            # rename the thread to avoid tests waiting for a longpolling
            current.setName("openerp.longpolling.request.%s" % current.ident)

        registry = odoo.registry(dbname)

        # immediatly returns if past notifications exist
        with registry.cursor() as cr:
            env = api.Environment(cr, SUPERUSER_ID, {})
            notifications = env['bus.bus'].poll(channels, last, options)

        # immediatly returns in peek mode
        if options.get('peek'):
            return dict(notifications=notifications, channels=channels)

        # or wait for future ones
        if not notifications:
            if not self.started:
                # Lazy start of events listener
                self.start()

            event = self.Event()
            for channel in channels:
                self.channels.setdefault(hashable(channel), set()).add(event)
            try:
                event.wait(timeout=timeout)
                with registry.cursor() as cr:
                    env = api.Environment(cr, SUPERUSER_ID, {})
                    notifications = env['bus.bus'].poll(channels, last, options)
            except Exception:
                # timeout
                pass
            finally:
                # gc pointers to event
                for channel in channels:
                    channel_events = self.channels.get(hashable(channel))
                    if channel_events and event in channel_events:
                        channel_events.remove(event)
        return notifications

    def loop(self):
        """ Dispatch postgres notifications to the relevant polling threads/greenlets """
        _logger.info("Bus.loop listen imbus on db postgres")
        with odoo.sql_db.db_connect('postgres').cursor() as cr:
            conn = cr._cnx
            cr.execute("listen imbus")
            cr.commit();
            while True:
                # 异步监听文件描述符，三个数组分别是指可读监控，可写监控，异常监控，
                # 如果数组中的文件描述符符合监控的条件就会返回
                if select.select([conn], [], [], TIMEOUT) == ([], [], []):
                    # 如果超时了
                    pass
                else:
                    conn.poll()
                    channels = []
                    # 读出所有的 notifies
                    while conn.notifies:
                        # 每个 notify 的数据 payload 就是 channel
                        channels.extend(json.loads(conn.notifies.pop().payload))
                    # dispatch to local threads/greenlets
                    events = set()
                    for channel in channels:
                        # 注意这里面用到 self.channels 这里面是 channel 和 event 的映射字典
                        # 通过 set 能够排除重复的 event，每个channel 对应一个 event 的集合，
                        # 就是可能很多客户在等候这个 channel，当然也可能没有任何客户在等候这个 channel
                        # 那么就是空集合
                        events.update(self.channels.pop(hashable(channel), set()))
                    for event in events:
                        # event 能够在多个协程之间通讯，客户使用 event wait在异步等待，这里面通过
                        # event set 通知等待可以结束了。
                        event.set()

    def run(self):
        while True:
            try:
                self.loop()
            except Exception as e:
                _logger.exception("Bus.loop error, sleep and retry")
                time.sleep(TIMEOUT)

    def start(self):
        if odoo.evented:
            # gevent mode
            import gevent
            self.Event = gevent.event.Event
            gevent.spawn(self.run)
        else:
            # threaded mode
            self.Event = threading.Event
            t = threading.Thread(name="%s.Bus" % __name__, target=self.run)
            t.daemon = True
            t.start()
        self.started = True
        return self

dispatch = None
if not odoo.multi_process or odoo.evented:
    # We only use the event dispatcher in threaded and gevent mode
    dispatch = ImDispatch()
