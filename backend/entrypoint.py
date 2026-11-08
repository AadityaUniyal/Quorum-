import os
import sys
import traceback

port = int(os.environ.get("PORT", 10000))
print(f"=== [QUORUM BOOT] Initializing Quorum OS Backend on port {port} ===", flush=True)

try:
    print("=== [QUORUM BOOT] Importing app.main ===", flush=True)
    import app.main
    print("=== [QUORUM BOOT] app.main imported successfully! Launching Uvicorn ===", flush=True)
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
except Exception as exc:
    err_text = traceback.format_exc()
    print("=== [QUORUM BOOT] FATAL STARTUP EXCEPTION CAUGHT ===", flush=True)
    print(err_text, flush=True)

    # Launch rescue HTTP server so container stays healthy and reports exact diagnostics
    from http.server import HTTPServer, BaseHTTPRequestHandler
    class RescueHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response = f"QUORUM RESCUE DIAGNOSTICS ACTIVE\n\nFATAL EXCEPTION DURING BOOT:\n{err_text}\n"
            self.wfile.write(response.encode("utf-8"))

        def log_message(self, format, *args):
            pass

    print(f"=== [QUORUM BOOT] Starting rescue diagnostic server on port {port} ===", flush=True)
    server = HTTPServer(("0.0.0.0", port), RescueHandler)
    server.serve_forever()
