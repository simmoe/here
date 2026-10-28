import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fritidshus_search.search import RESULTS_PATH, run

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "fritidshus" / "index.html"
PORT = 8765


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/fritidshus", "/fritidshus/"):
            self._send(PAGE.read_bytes(), "text/html; charset=utf-8")
            return
        if path == "/fritidshus/results.json":
            if RESULTS_PATH.exists():
                self._send(RESULTS_PATH.read_bytes(), "application/json")
            else:
                self._send(b"{}", "application/json", 404)
            return
        self._send(b"", "text/plain", 404)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/fritidshus/search":
            self._send(b"", "text/plain", 404)
            return
        try:
            report = run()
        except Exception as error:
            body = json.dumps({"error": str(error)}, ensure_ascii=False).encode()
            self._send(body, "application/json", 500)
            return
        self._send(json.dumps(report, ensure_ascii=False).encode(), "application/json")

    def _send(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


def serve():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"http://localhost:{PORT}/fritidshus/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve()
    else:
        run()
