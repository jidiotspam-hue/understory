#!/usr/bin/env python3
"""
understory — Phone Streaming Relay
Serves the vault site + your s*.mp4 files from ~/Downloads with HTTP Range
support (needed for seeking on iOS/Android). Everything lives under a random
secret path prefix, and only the vault files and s<N>.mp4 files are exposed.
Pair with a cloudflared quick tunnel (see stream_phone.sh) for HTTPS.
"""

import os
import re
import secrets
import socket
import sys
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get('UNDERSTORY_PORT', '8888'))
SITE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.expanduser('~/Downloads')
TOKEN = os.environ.get('UNDERSTORY_TOKEN') or secrets.token_urlsafe(12)

SITE_FILES = {
    'index.html': 'text/html; charset=utf-8',
    'player.html': 'text/html; charset=utf-8',
    'app.js': 'text/javascript; charset=utf-8',
    'data.js': 'text/javascript; charset=utf-8',
    'style.css': 'text/css; charset=utf-8',
}
MEDIA_RE = re.compile(r'^s\d+(-2)?\.mp4$')


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        pass

    def _deny(self, code=404):
        self.send_response(code)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        prefix = '/' + TOKEN + '/'
        if not path.startswith(prefix):
            return self._deny(404)
        rel = path[len(prefix):] or 'index.html'

        if rel == 'ping':  # liveness probe used by the GitHub Pages vault
            body = b'ok'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', 'https://jidiotspam-hue.github.io')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if not head_only:
                self.wfile.write(body)
            return

        if rel in SITE_FILES:
            return self._send_file(os.path.join(SITE_DIR, rel), SITE_FILES[rel], head_only, no_store=True)

        if rel.startswith('media/'):
            name = rel[len('media/'):]
            if MEDIA_RE.match(name):
                return self._send_file(os.path.join(DOWNLOADS_DIR, name), 'video/mp4', head_only)

        return self._deny(404)

    def _send_file(self, fp, ctype, head_only, no_store=False):
        if not os.path.isfile(fp):
            return self._deny(404)
        size = os.path.getsize(fp)
        start, end, status = 0, size - 1, 200
        rng = self.headers.get('Range')
        if rng:
            m = re.match(r'bytes=(\d*)-(\d*)$', rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:  # suffix range
                    start = max(0, size - int(m.group(2)))
                if start >= size:
                    self.send_response(416)
                    self.send_header('Content-Range', f'bytes */{size}')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(length))
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        if no_store:
            self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        self.end_headers()
        if head_only:
            return
        try:
            with open(fp, 'rb') as f:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(256 * 1024, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'[understory] relay on port {PORT}', flush=True)
    print(f'[understory] secret path: /{TOKEN}/', flush=True)
    print(f'[understory] LAN (no HTTPS, will not unlock): http://{lan_ip()}:{PORT}/{TOKEN}/', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.server_close()
        sys.exit(0)
