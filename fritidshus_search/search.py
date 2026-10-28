import base64
import hashlib
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from fritidshus_search.cache import get, put
from fritidshus_search.net import request

MAX_DKK = 2_000_000
MAX_DRIVE_SECONDS = 2 * 60 * 60
HOUSE_TYPES = {"Villa", "Fritidshus", "Gård"}
TYPE_IDS = [0, 1, 4]  # villa, fritidshus, gård
LAN = ["12", "13", "10", "07"]  # Skåne, Halland, Blekinge, Kronoberg
ORIGINS = [
    {"id": "ejderstedgade", "label": "Ejderstedgade 2", "query": "Ejderstedgade 2, København"},
    {"id": "toftekaersvej", "label": "Toftekærsvej 91", "query": "Toftekærsvej 91, Søborg"},
]
PROMPT_VERSION = "1"
WATER_TEXT = re.compile(
    r"\b(hav|havet|havs\w+|strand\w+|sjö|sjön|sjö\w+|insjö\w*|badplats\w*|badstrand\w*|bada|brygga|kust\w*|skärgård\w*|vattendrag\w*|ån)\b",
    re.IGNORECASE,
)
RESULTS_PATH = Path(__file__).resolve().parents[1] / "fritidshus" / "results.json"
VAULT = Path.home() / "Documents/Git/cursor-global-setup/.cursor-local/vault/secrets.payload.json"


def geocode(query):
    cached = get("geocode", query)
    if cached:
        return cached
    url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + urllib_quote(query)
    status, raw = request(url, headers={"Accept": "application/json"})
    if status != 200:
        raise RuntimeError(f"Geokodning fejlede ({status}) for {query}")
    hits = json.loads(raw)
    if not hits:
        raise RuntimeError(f"Fandt ikke adressen {query}")
    point = {"lat": float(hits[0]["lat"]), "lon": float(hits[0]["lon"])}
    put("geocode", query, point)
    time.sleep(1)
    return point


def urllib_quote(value):
    from urllib.parse import quote

    return quote(value)


def sek_to_dkk_rate():
    cached = get("fx", "SEK-DKK", max_age=12 * 60 * 60)
    if cached:
        return cached["rate"]
    status, raw = request("https://api.frankfurter.app/latest?from=SEK&to=DKK")
    if status != 200:
        raise RuntimeError(f"Valutakurs fejlede ({status})")
    rate = float(json.loads(raw)["rates"]["DKK"])
    put("fx", "SEK-DKK", {"rate": rate})
    return rate


def parse_sek(meta):
    if not meta:
        return None
    digits = "".join(ch for ch in meta[0] if ch.isdigit())
    if not digits:
        return None
    return int(digits)


def search_fastighetsbyran(max_sek):
    body = {
        "valdaMaeklarObjektTyper": TYPE_IDS,
        "valdaLaen": LAN,
        "maxPris": max_sek,
        "inkluderaNyproduktion": False,
        "inkluderaPaaGaang": True,
    }
    first_status, first_raw = request(
        "https://www.fastighetsbyran.com/HemsidanAPI/api/v1/soek/objekt/1/false/",
        method="POST",
        body=body,
    )
    if first_status != 200:
        raise RuntimeError(f"Fastighetsbyrån svarede {first_status}")
    first = json.loads(first_raw)
    page_count = int(first.get("pageCount") or 1)
    rows = list(first.get("results") or [])
    for page in range(2, page_count + 1):
        status, raw = request(
            f"https://www.fastighetsbyran.com/HemsidanAPI/api/v1/soek/objekt/{page}/false/",
            method="POST",
            body=body,
        )
        if status != 200:
            raise RuntimeError(f"Fastighetsbyrån side {page} svarede {status}")
        rows.extend(json.loads(raw).get("results") or [])
    seen = set()
    houses = []
    for row in rows:
        if row.get("bostadsTyp") not in HOUSE_TYPES:
            continue
        listing_id = str(row.get("maeklarObjektId"))
        if listing_id in seen:
            continue
        seen.add(listing_id)
        price_sek = parse_sek(row.get("metaData"))
        lat = row.get("xKoordinat")
        lon = row.get("yKoordinat")
        if price_sek is None or lat is None or lon is None:
            continue
        photos = []
        for image in row.get("bildUrlLista") or []:
            url = image.get("bildUrl") if isinstance(image, dict) else None
            if url and url not in photos:
                photos.append(url)
            if len(photos) == 5:
                break
        if not photos and row.get("bildUrl"):
            photos.append(row["bildUrl"])
        houses.append(
            {
                "id": "fastighetsbyran:" + listing_id,
                "source": "Fastighetsbyrån",
                "url": row.get("url"),
                "address": row.get("storRubrik") or "",
                "area": row.get("litenRubrik") or "",
                "type": row.get("bostadsTyp"),
                "priceSek": price_sek,
                "lat": float(lat),
                "lon": float(lon),
                "photos": photos,
            }
        )
    return houses


def listing_text(house):
    cached = get("listing-text", house["id"])
    if cached:
        return cached["text"]
    numeric = house["id"].split(":", 1)[1]
    status, raw = request(f"https://www.fastighetsbyran.com/HemsidanAPI/api/v1/MaeklarObjekt/{numeric}")
    parts = [house.get("address") or "", house.get("area") or ""]
    if status == 200:
        obj = json.loads(raw).get("maeklarObjekt") or {}
        parts.append(obj.get("beskrivningKort") or "")
        description = obj.get("objektsbeskrivning") or {}
        if isinstance(description, dict):
            parts.append(description.get("beskrivning") or "")
    text = " ".join(part for part in parts if part)
    if status == 200:
        put("listing-text", house["id"], {"text": text})
    return text


def text_suggests_water(text):
    return bool(WATER_TEXT.search(text or ""))


def source_status(name, url):
    cached = get("source", name, max_age=24 * 60 * 60)
    if cached:
        return cached
    status, raw = request(url, headers={"Accept": "text/html"})
    text = raw[:400].decode("utf-8", errors="replace").lower()
    blocked = status in (403, 503) or "just a moment" in text or "et øjeblik" in text
    result = {"name": name, "ok": status == 200 and not blocked, "status": status}
    put("source", name, result)
    return result


def drive_seconds(origin, lat, lon):
    key = f"{origin['id']}|{lat:.4f}|{lon:.4f}"
    cached = get("route", key)
    if cached:
        return cached["seconds"]
    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{origin['lon']},{origin['lat']};{lon},{lat}?overview=false"
    )
    status, raw = request(url)
    if status != 200:
        return None
    payload = json.loads(raw)
    if payload.get("code") != "Ok" or not payload.get("routes"):
        return None
    seconds = int(payload["routes"][0]["duration"])
    put("route", key, {"seconds": seconds})
    time.sleep(0.05)
    return seconds


def qualifying_drive(house, origins):
    order = sorted(origins, key=lambda origin: (origin["lat"] - house["lat"]) ** 2 + (origin["lon"] - house["lon"]) ** 2)
    best = None
    for origin in order:
        seconds = drive_seconds(origin, house["lat"], house["lon"])
        if seconds is None:
            continue
        if best is None or seconds < best["seconds"]:
            best = {"seconds": seconds, "origin": origin["label"]}
        if seconds <= MAX_DRIVE_SECONDS:
            return best
    return best if best and best["seconds"] <= MAX_DRIVE_SECONDS else None


def gemini_key():
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    data = json.loads(VAULT.read_text())
    return data["aiApiKeys"]["geminiApiKey"]


def shrink(image_bytes):
    source = Path("/tmp/fritidshus-in")
    target = Path("/tmp/fritidshus-out.jpg")
    source.write_bytes(image_bytes)
    try:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-Z", "384", str(source), "--out", str(target)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return target.read_bytes()
    except (subprocess.CalledProcessError, OSError):
        return image_bytes


def satellite(lat, lon):
    pad = 0.003
    bbox = f"{lon - pad},{lat - pad},{lon + pad},{lat + pad}"
    url = (
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
        f"?bbox={bbox}&bboxSR=4326&imageSR=4326&size=512,512&format=jpg&f=image"
    )
    status, raw = request(url, headers={"Accept": "image/jpeg"})
    if status != 200 or not raw:
        return None
    return raw


def gemini_model(key):
    cached = get("gemini-model", "name", max_age=7 * 24 * 60 * 60)
    if cached:
        return cached["name"]
    status, raw = request(
        "https://generativelanguage.googleapis.com/v1beta/models",
        headers={"x-goog-api-key": key},
    )
    if status != 200:
        raise RuntimeError(f"Kunne ikke læse Gemini-modeller ({status})")
    models = json.loads(raw).get("models", [])
    usable = []
    for item in models:
        methods = item.get("supportedGenerationMethods") or []
        if "generateContent" in methods:
            usable.append(item.get("name", ""))
    preferred = [
        "models/gemini-2.5-flash",
        "models/gemini-2.0-flash",
        "models/gemini-flash-latest",
    ]
    chosen = next((name for name in preferred if name in usable), None)
    if not chosen:
        chosen = next((name for name in usable if name.endswith("flash")), None)
    if not chosen:
        raise RuntimeError("Fandt ingen Gemini Flash-model")
    put("gemini-model", "name", {"name": chosen})
    return chosen


def judge_water(house, key, model):
    photo_key = hashlib.sha256(
        (PROMPT_VERSION + "|" + "|".join(house["photos"][:5])).encode()
    ).hexdigest()
    cache_key = house["id"] + "|" + photo_key
    cached = get("vision", cache_key)
    if cached:
        return cached

    parts = [
        {
            "text": (
                "Vurder om huset har direkte udsigt til hav, en badesø eller en å. "
                "Du får op til fem annoncefotos i den rækkefølge mægleren har lagt dem op, "
                "og ét satellitbillede med huset i midten. "
                "Svar true kun hvis vandet kan ses fra huset eller terrassen på fotoene, "
                "eller satellitbilledet viser at hav, sø eller å støder op til grunden. "
                "En grøft, en havedam eller vand langt fra grunden tæller ikke. "
                "Nærhed i en tekst tæller ikke, og du har ingen tekst. "
                "evidence skal være én kort sætning på dansk. "
                'JSON: {"has_direct_water_view": false, "water_type": "none", "evidence": ""} '
                "water_type er sea, lake, river eller none."
            )
        }
    ]
    images = []
    for url in house["photos"][:5]:
        status, raw = request(url, headers={"Accept": "image/*"})
        if status == 200 and raw:
            images.append(raw)
    sat = satellite(house["lat"], house["lon"])
    if sat:
        images.append(sat)
    if not images:
        return None
    for raw in images:
        try:
            jpeg = shrink(raw)
        except subprocess.CalledProcessError:
            jpeg = raw
        parts.append(
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(jpeg).decode(),
                }
            }
        )
    status, raw = request(
        f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent",
        method="POST",
        headers={"x-goog-api-key": key},
        body={
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        },
        timeout=90,
    )
    if status != 200:
        return None
    try:
        text = json.loads(raw)["candidates"][0]["content"]["parts"][0]["text"]
        verdict = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError):
        return None
    water = verdict.get("water_type")
    ok = bool(verdict.get("has_direct_water_view")) and water in {"sea", "lake", "river"}
    result = {
        "ok": ok,
        "waterType": water if ok else "none",
        "evidence": verdict.get("evidence") or "",
    }
    put("vision", cache_key, result)
    return result


def public_house(house):
    water_name = {"sea": "hav", "lake": "sø", "river": "å"}
    return {
        "id": house["id"],
        "address": house["address"],
        "area": house["area"],
        "type": house["type"],
        "priceDkk": house["priceDkk"],
        "priceSek": house["priceSek"],
        "minutes": round(house["driveSeconds"] / 60),
        "driveFrom": house["driveFrom"],
        "water": water_name.get(house["waterType"], house["waterType"]),
        "evidence": house["evidence"],
        "url": house["url"],
        "photo": house["photos"][0] if house["photos"] else "",
    }


def write_report(started, rate, houses, priced, within, matches, error="", done=False):
    public = [public_house(house) for house in sorted(matches, key=lambda item: item["priceDkk"])]
    for house in public:
        put("match", house["id"], house)
    hemnet = get("source", "Hemnet") or {"ok": False}
    booli = get("source", "Booli") or {"ok": False}
    report = {
        "ranAt": datetime.now(timezone.utc).isoformat(),
        "seconds": round(time.time() - started),
        "done": done,
        "rate": rate,
        "error": error,
        "counts": {
            "houses": len(houses),
            "underPrice": len(priced),
            "withinDrive": len(within),
            "withWater": len(public),
        },
        "sources": [
            {"name": "Fastighetsbyrån", "ok": True},
            {"name": "Hemnet", "ok": bool(hemnet.get("ok"))},
            {"name": "Booli", "ok": bool(booli.get("ok"))},
        ],
        "houses": public,
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def finish(started, rate, houses, priced, within, matches, error=""):
    source_status("Hemnet", "https://www.hemnet.se/bostader")
    source_status("Booli", "https://www.booli.se/")
    report = write_report(started, rate, houses, priced, within, matches, error, done=True)
    print(
        f"færdig: {len(report['houses'])} huse med vand, af {len(within)} inden for to timer",
        flush=True,
    )
    return report


def run():
    started = time.time()
    for origin in ORIGINS:
        point = geocode(origin["query"])
        origin["lat"] = point["lat"]
        origin["lon"] = point["lon"]
    rate = sek_to_dkk_rate()
    max_sek = int(MAX_DKK / rate) + 1
    houses = search_fastighetsbyran(max_sek)
    priced = []
    for house in houses:
        dkk = int(round(house["priceSek"] * rate))
        if dkk < MAX_DKK:
            house["priceDkk"] = dkk
            priced.append(house)

    within = []
    for index, house in enumerate(priced, start=1):
        drive = qualifying_drive(house, ORIGINS)
        if drive:
            house["driveSeconds"] = drive["seconds"]
            house["driveFrom"] = drive["origin"]
            within.append(house)
        if index % 25 == 0 or index == len(priced):
            print(f"køretid {index}/{len(priced)}, inden for to timer: {len(within)}", flush=True)

    key = gemini_key().strip()
    if not key:
        report = finish(started, rate, houses, priced, within, [], "Gemini-nøglen i vaulten er tom, så billederne er ikke vurderet.")
        print(report["error"], flush=True)
        return report
    model = gemini_model(key)
    print(f"billedmodel {model}", flush=True)
    matches = []
    write_report(started, rate, houses, priced, within, matches)
    vision_failures = 0
    text_hits = 0
    for index, house in enumerate(within, start=1):
        if not text_suggests_water(listing_text(house)):
            if index % 25 == 0 or index == len(within):
                print(f"tekst {index}/{len(within)}, med vandord: {text_hits}", flush=True)
            continue
        text_hits += 1
        verdict = judge_water(house, key, model)
        if verdict is None:
            vision_failures += 1
            if vision_failures >= 3 and not matches:
                raise RuntimeError("Billedvurderingen fejlede tre gange i træk")
        else:
            vision_failures = 0
        if verdict and verdict["ok"]:
            house["waterType"] = verdict["waterType"]
            house["evidence"] = verdict["evidence"]
            matches.append(house)
            write_report(started, rate, houses, priced, within, matches)
        if index % 10 == 0 or index == len(within):
            print(f"billeder {index}/{len(within)}, med vand: {len(matches)}", flush=True)

    return finish(started, rate, houses, priced, within, matches)
