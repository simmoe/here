import json
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DB_PATH = DATA / "cache.sqlite"


def connect():
    DATA.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute(
        """
        create table if not exists entry (
            kind text not null,
            key text not null,
            value text not null,
            stored_at integer not null,
            primary key (kind, key)
        )
        """
    )
    return db


def get(kind, key, max_age=None):
    with connect() as db:
        row = db.execute(
            "select value, stored_at from entry where kind = ? and key = ?",
            (kind, key),
        ).fetchone()
    if not row:
        return None
    value, stored_at = row
    if max_age is not None and time.time() - stored_at > max_age:
        return None
    return json.loads(value)


def put(kind, key, value):
    payload = json.dumps(value, ensure_ascii=False)
    now = int(time.time())
    with connect() as db:
        db.execute(
            """
            insert into entry (kind, key, value, stored_at)
            values (?, ?, ?, ?)
            on conflict(kind, key) do update set value = excluded.value, stored_at = excluded.stored_at
            """,
            (kind, key, payload, now),
        )
