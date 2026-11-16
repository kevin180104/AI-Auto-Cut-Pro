"""Loopback-only test backend for the AI Auto Cut Pro CEP POC; transfers no audio."""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import logging
import time

HOST = "127.0.0.1"
PORT = 8765
MAX_BODY = 2048
logging.basicConfig(level=logging.INFO, format="%(asctime)sZ %(levelname)s %(message)s")
logging.Formatter.converter = time.gmtime


class Handler(BaseHTTPRequestHandler):
    server_version = "AACP-POC/0.1"

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "60")
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self._send(404, {"ok": False, "code": "ENDPOINT_NOT_FOUND"})
            return
        self._send(200, {"ok": True, "service": "AACP local POC", "timestamp": datetime.now(timezone.utc).isoformat()})

    def do_POST(self):
        if self.path != "/echo":
            self._send(404, {"ok": False, "code": "ENDPOINT_NOT_FOUND"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BODY:
                raise ValueError("BODY_SIZE_INVALID")
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(request, dict) or request.get("probe") != "aacp-cep-poc" or not isinstance(request.get("requestId"), str):
                raise ValueError("PROBE_REQUEST_INVALID")
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError, AttributeError) as exc:
            code = str(exc) if str(exc) in {"BODY_SIZE_INVALID", "PROBE_REQUEST_INVALID"} else "REQUEST_JSON_INVALID"
            logging.warning("code=%s path=/echo", code)
            self._send(400, {"ok": False, "code": code})
            return
        logging.info("code=PROBE_ECHO_OK requestId=%s", request["requestId"])
        self._send(200, {"ok": True, "service": "AACP local POC", "reply": "round-trip-ok", "requestId": request["requestId"]})

    def log_message(self, fmt, *args):
        logging.info("http=" + fmt, *args)


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    logging.info("code=BACKEND_STARTED address=%s:%s", HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("code=BACKEND_STOPPED")
    finally:
        server.server_close()
