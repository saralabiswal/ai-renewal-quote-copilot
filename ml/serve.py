from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from predict import EXPANSION_MODEL_PATH, RISK_META_PATH, RISK_MODEL_PATH, predict_payload
from predict import ROOT


HOST = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("ML_SERVICE_PORT", "8010"))


def display_path(path):
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return path.name


def health_payload():
    return {
        "status": "OK",
        "service": "renewal-ml-service",
        "riskModelExists": RISK_MODEL_PATH.exists(),
        "riskMetadataExists": RISK_META_PATH.exists(),
        "expansionModelExists": EXPANSION_MODEL_PATH.exists(),
        "modelPath": display_path(RISK_MODEL_PATH),
    }


class MlHandler(BaseHTTPRequestHandler):
    server_version = "RenewalMlService/0.1"

    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, health_payload())
            return
        self._send_json(404, {"status": "NOT_FOUND"})

    def do_POST(self):
        if self.path != "/predict":
            self._send_json(404, {"status": "NOT_FOUND"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            request = json.loads(raw or "{}")
            self._send_json(200, predict_payload(request))
        except Exception as error:
            self._send_json(500, {"status": "ERROR", "error": str(error)})

    def log_message(self, format, *args):
        return


def main():
    server = ThreadingHTTPServer((HOST, PORT), MlHandler)
    print(json.dumps({"status": "OK", "serviceUrl": f"http://{HOST}:{PORT}"}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
