import json
import ssl
import urllib.error
import urllib.request

_SSL = ssl.create_default_context()
_SSL.load_verify_locations("/etc/ssl/cert.pem")

UA = "fritidshus/1 (personal search)"


def request(url, method="GET", body=None, headers=None, timeout=40):
    hdrs = {"User-Agent": UA, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, context=_SSL, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()
