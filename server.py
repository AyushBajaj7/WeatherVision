import http.server
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus

def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    os.environ[key] = val

load_dotenv()

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
OPENWEATHER_BASE    = "https://api.openweathermap.org/data/2.5"
OPEN_METEO_BASE     = "https://api.open-meteo.com/v1/forecast"
STATIC_DIR          = os.path.dirname(__file__)
HOST                = "localhost"
PORT                = 8080
REQUEST_TIMEOUT     = 15


def fetch_json(url: str) -> dict:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "WeatherVision/1.0"},
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            return {"error": "Weather service credentials are invalid."}
        if exc.code == 404:
            return {"error": "City not found. Please check the spelling."}
        return {"error": f"Weather service error {exc.code}. Please try again."}
    except urllib.error.URLError:
        return {"error": "Weather service is unavailable right now."}
    except (json.JSONDecodeError, ValueError):
        return {"error": "Weather service returned an invalid response."}
    except Exception as exc:  # pylint: disable=broad-except
        return {"error": f"Unexpected error: {exc}"}


def build_ow_url(endpoint: str, params: dict) -> str:
    params["appid"] = OPENWEATHER_API_KEY
    qs = urllib.parse.urlencode(params)
    return f"{OPENWEATHER_BASE}/{endpoint}?{qs}"


def fetch_current_by_city(city: str) -> dict:
    url = build_ow_url("weather", {"q": city, "units": "metric"})
    return fetch_json(url)


def fetch_current_by_coords(lat: str, lon: str) -> dict:
    url = build_ow_url("weather", {"lat": lat, "lon": lon, "units": "metric"})
    return fetch_json(url)


def fetch_forecast_by_coords(lat: str, lon: str) -> dict:
    url = build_ow_url("forecast", {"lat": lat, "lon": lon, "units": "metric"})
    return fetch_json(url)


def fetch_air_quality(lat: str, lon: str) -> dict:
    url = build_ow_url("air_pollution", {"lat": lat, "lon": lon})
    return fetch_json(url)


def fetch_precipitation(lat: str, lon: str) -> dict:
    params = {
        "latitude":          lat,
        "longitude":         lon,
        "hourly":            "precipitation,temperature_2m",
        "past_hours":        "24",
        "forecast_hours":    "48",
        "timezone":          "auto",
        "precipitation_unit": "mm",
    }
    qs = urllib.parse.urlencode(params)
    return fetch_json(f"{OPEN_METEO_BASE}?{qs}")


MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png":  "image/png",
    ".ico":  "image/x-icon",
    ".svg":  "image/svg+xml",
    ".woff2": "font/woff2",
}


class WeatherHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path   = parsed.path.rstrip("/") or "/"
        qs     = urllib.parse.parse_qs(parsed.query)

        if path == "/api/weather/current":
            self._handle_current(qs)
        elif path == "/api/weather/forecast":
            self._handle_forecast(qs)
        elif path == "/api/weather/air-quality":
            self._handle_air_quality(qs)
        elif path == "/api/weather/precipitation":
            self._handle_precipitation(qs)
        elif path == "/api/health":
            self._json_ok({"status": "ok", "server": "WeatherVision"})
        else:
            self._serve_static(path)

    def _serve_static(self, path: str):
        if path == "/":
            path = "/index.html"

        # Prevent path traversal
        safe_path = os.path.realpath(os.path.join(STATIC_DIR, path.lstrip("/")))
        if not safe_path.startswith(os.path.realpath(STATIC_DIR)):
            self._error(403, "Forbidden")
            return

        if not os.path.isfile(safe_path):
            self._error(404, "Not found")
            return

        _, ext = os.path.splitext(safe_path)
        mime = MIME_TYPES.get(ext.lower(), "application/octet-stream")

        with open(safe_path, "rb") as fh:
            body = fh.read()

        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _handle_current(self, qs: dict):
        city = qs.get("city", [None])[0]
        lat  = qs.get("lat",  [None])[0]
        lon  = qs.get("lon",  [None])[0]

        if city:
            data = fetch_current_by_city(city)
        elif lat and lon:
            data = fetch_current_by_coords(lat, lon)
        else:
            self._json_error(400, "city or lat/lon is required")
            return

        self._json_ok(data)

    def _handle_forecast(self, qs: dict):
        lat = qs.get("lat", [None])[0]
        lon = qs.get("lon", [None])[0]
        if not lat or not lon:
            self._json_error(400, "lat and lon are required")
            return
        self._json_ok(fetch_forecast_by_coords(lat, lon))

    def _handle_air_quality(self, qs: dict):
        lat = qs.get("lat", [None])[0]
        lon = qs.get("lon", [None])[0]
        if not lat or not lon:
            self._json_error(400, "lat and lon are required")
            return
        self._json_ok(fetch_air_quality(lat, lon))

    def _handle_precipitation(self, qs: dict):
        lat = qs.get("lat", [None])[0]
        lon = qs.get("lon", [None])[0]
        if not lat or not lon:
            self._json_error(400, "lat and lon are required")
            return
        self._json_ok(fetch_precipitation(lat, lon))

    def _json_ok(self, data: dict):
        self._json_response(200, data)

    def _json_error(self, code: int, message: str):
        self._json_response(code, {"error": message})

    def _json_response(self, code: int, data: dict):
        body = json.dumps(data, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code: int, message: str):
        body = message.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = http.server.ThreadingHTTPServer((HOST, PORT), WeatherHandler)
    print("=" * 46)
    print("  WeatherVision - Server Starting")
    print(f"  http://{HOST}:{PORT}")
    print("=" * 46)
    print(f"  Static : {STATIC_DIR}")
    if OPENWEATHER_API_KEY:
        print(f"  API Key: Loaded ({OPENWEATHER_API_KEY[:4]}...{OPENWEATHER_API_KEY[-4:]})")
    else:
        print("  API Key: WARNING - NOT FOUND in .env or environment variables!")
    print("  Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()

