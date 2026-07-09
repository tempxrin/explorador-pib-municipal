"""
API + Frontend Server
Proxy IBGE com cache + serve arquivos estáticos
"""

import http.server
import urllib.request
import urllib.error
import json
import os
import hashlib
import time
import gzip
import threading

IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1"
WEB_DIR = os.path.join(os.path.dirname(__file__), "..", "web")
CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
CACHE_TTL = 86400 * 7

os.makedirs(CACHE_DIR, exist_ok=True)

MIME_TYPES = {
    ".html": "text/html", ".css": "text/css",
    ".js": "application/javascript", ".json": "application/json",
    ".png": "image/png", ".svg": "image/svg+xml",
}

_pib_cache = {}
_municipios_cache = None
_lock = threading.Lock()

def cache_key(url):
    return hashlib.md5(url.encode()).hexdigest()

def get_cached(url):
    key = cache_key(url)
    path = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(path):
        age = time.time() - os.path.getmtime(path)
        if age < CACHE_TTL:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return None

def set_cached(url, data):
    key = cache_key(url)
    path = os.path.join(CACHE_DIR, f"{key}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)

def fetch_ibge(path):
    url = f"{IBGE_BASE}{path}"
    cached = get_cached(url)
    if cached:
        return cached
    req = urllib.request.Request(url, headers={
        "User-Agent": "IBGE-PIB/1.0",
        "Accept-Encoding": "gzip, deflate"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        data = json.loads(raw.decode("utf-8"))
    set_cached(url, data)
    return data

def load_all_pibs():
    global _pib_cache, _municipios_cache
    print("Carregando lista de municípios...")
    mdata = fetch_ibge("/localidades/municipios")
    _municipios_cache = []
    for m in mdata:
        try:
            uf = m["microrregiao"]["mesorregiao"]["UF"]
            _municipios_cache.append({
                "cod_ibge": str(m["id"]),
                "nome": m["nome"],
                "sigla_uf": uf["sigla"],
                "cod_uf": str(uf["id"]),
                "nome_estado": uf["nome"],
                "nome_regiao": uf["regiao"]["nome"],
            })
        except (KeyError, TypeError):
            continue

    print(f"Carregando PIB de {len(_municipios_cache)} municípios...")
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def fetch_pib_one(cod):
        try:
            data_cap = fetch_ibge(f"/pesquisas/38/indicadores/47001/resultados/{cod}")
            data_total = fetch_ibge(f"/pesquisas/38/indicadores/46997/resultados/{cod}")
            
            vals = {}
            if data_cap and data_cap[0].get("res"):
                res = data_cap[0]["res"][0]["res"]
                for ano, valor in res.items():
                    if valor:
                        vals[ano] = {"per_capita": float(valor)}
            
            if data_total and data_total[0].get("res"):
                res = data_total[0]["res"][0]["res"]
                for ano, valor in res.items():
                    if valor and ano in vals:
                        vals[ano]["total"] = float(valor) * 1000
            
            return cod, vals
        except:
            return cod, {}

    with ThreadPoolExecutor(max_workers=40) as ex:
        futures = {ex.submit(fetch_pib_one, m["cod_ibge"]): m["cod_ibge"] for m in _municipios_cache}
        done = 0
        for f in as_completed(futures):
            cod, vals = f.result()
            _pib_cache[cod] = vals
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(_municipios_cache)}")

    print(f"✓ {len(_pib_cache)} municípios carregados")

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api()
        else:
            self.handle_static()

    def handle_api(self):
        try:
            if self.path == "/api/health":
                self.send_json({"status": "ok", "loaded": len(_pib_cache)})
            elif self.path == "/api/municipios":
                self.send_json(_municipios_cache or [])
            elif self.path.startswith("/api/pib/"):
                self.handle_pib()
            elif self.path == "/api/all-pibs":
                self.handle_all_pibs()
            else:
                self.send_error(404)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_pib(self):
        cod = self.path.split("/")[3]
        vals = _pib_cache.get(cod, {})
        if not vals:
            self.send_json({"error": "Sem dados"}, 404)
            return
        self.send_json({"cod_ibge": cod, "valores": vals})

    def handle_all_pibs(self):
        result = []
        for m in (_municipios_cache or []):
            vals = _pib_cache.get(m["cod_ibge"], {})
            max_ano = max(vals.keys(), key=int) if vals else None
            if max_ano:
                year_data = vals[max_ano]
                result.append({
                    **m,
                    "pib": year_data.get("per_capita", 0),
                    "pib_total": year_data.get("total", 0),
                    "ano": int(max_ano)
                })
        self.send_json(result)

    def handle_static(self):
        path = self.path.split("?")[0]
        if path == "/":
            path = "/index.html"
        filepath = os.path.join(WEB_DIR, path.lstrip("/"))
        if not os.path.exists(filepath) or not os.path.isfile(filepath):
            self.send_error(404)
            return
        ext = os.path.splitext(filepath)[1]
        mime = MIME_TYPES.get(ext, "application/octet-stream")
        with open(filepath, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    PORT = 3000
    threading.Thread(target=load_all_pibs, daemon=True).start()
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Servidor: http://localhost:{PORT}")
    server.serve_forever()