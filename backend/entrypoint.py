import os
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ.get("PORT", 10000))
print(f"=== [QUORUM BOOT] Initializing Quorum OS Backend on port {port} ===", flush=True)


class RescueHandler(BaseHTTPRequestHandler):
    err_text = ""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        response = f"QUORUM RESCUE DIAGNOSTICS ACTIVE\n\nFATAL EXCEPTION DURING BOOT:\n{RescueHandler.err_text}\n"
        self.wfile.write(response.encode("utf-8"))

    def log_message(self, format, *args):
        pass


try:
    print("=== [QUORUM BOOT] Importing app.main ===", flush=True)
    import app.main  # noqa: F401
    print("=== [QUORUM BOOT] app.main imported successfully! Launching Uvicorn ===", flush=True)
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
except Exception:
    err_text = traceback.format_exc()
    RescueHandler.err_text = err_text
    print("=== [QUORUM BOOT] FATAL STARTUP EXCEPTION CAUGHT ===", flush=True)
    print(err_text, flush=True)

    print(f"=== [QUORUM BOOT] Starting rescue diagnostic server on port {port} ===", flush=True)
    server = HTTPServer(("0.0.0.0", port), RescueHandler)
    server.serve_forever()

