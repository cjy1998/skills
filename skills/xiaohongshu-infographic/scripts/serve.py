#!/usr/bin/env python3
"""本地预览 + PNG 导出接收服务。用法: python3 serve.py [--root DIR] [--port 8767]"""
import argparse
import re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

parser = argparse.ArgumentParser()
parser.add_argument('--root', default=str(Path(__file__).resolve().parent))
parser.add_argument('--port', type=int, default=8767)
args = parser.parse_args()
ROOT = Path(args.root).resolve()
NAME_RE = re.compile(r'(?:[0-9]{2}-[a-z0-9-]+|contact-sheet)\.png')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def do_POST(self):
        target = urlparse(self.path)
        name = parse_qs(target.query).get('name', [''])[0]
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if target.path != '/export' or not NAME_RE.fullmatch(name) or not 0 < length < 15_000_000:
            self.send_error(400)
            return
        data = self.rfile.read(length)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            self.send_error(400)
            return
        out = ROOT / 'images' / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        print(f'saved images/{name} ({len(data)/1024:.0f} KB)', flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')


if __name__ == '__main__':
    print(f'serving {ROOT} at http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
