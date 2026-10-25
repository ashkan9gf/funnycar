#!/usr/bin/env python3
"""سرور بدون کش برای E2E — Cache-Control: no-store"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
DIR = sys.argv[2] if len(sys.argv) > 2 else "out"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *a):
        pass


class ThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    import functools
    handler = functools.partial(NoCacheHandler, directory=DIR)
    with ThreadingServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"serving {DIR} on {PORT} (no-cache)")
        httpd.serve_forever()
