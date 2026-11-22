"""
Lightweight usage counter backed by SQLite.

Each call to an API endpoint records one row: when it happened, which
endpoint, the HTTP status, how long it took, a salted hash of the client
IP (so unique visitors can be counted without storing IPs), the request
origin and a coarse client type (browser / script / bot).

The database lives at USAGE_DB_PATH (default /data/usage.db, a Railway
volume mount). If that directory doesn't exist, it falls back to a file in
the temp directory, which works but resets on every deploy.
"""

import hashlib
import logging
import os
import sqlite3
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_DEFAULT_PATH = "/data/usage.db"
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None
_salt = ""


def _resolve_path() -> str:
    path = os.environ.get("USAGE_DB_PATH", _DEFAULT_PATH)
    directory = os.path.dirname(path) or "."
    if os.path.isdir(directory) and os.access(directory, os.W_OK):
        return path
    fallback = os.path.join(tempfile.gettempdir(), "usage.db")
    logger.warning(
        "Usage DB directory %r is missing or not writable; using %r instead "
        "(counts will reset on redeploy). Attach a volume at %r to persist them.",
        directory, fallback, directory,
    )
    return fallback


def init() -> None:
    """Open the database and create the table if needed. Never raises."""
    global _conn, _salt
    try:
        path = _resolve_path()
        _conn = sqlite3.connect(path, check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                status INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                visitor TEXT NOT NULL,
                origin TEXT,
                client TEXT NOT NULL
            )
            """
        )
        _conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts)")
        _conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        row = _conn.execute("SELECT value FROM meta WHERE key = 'salt'").fetchone()
        if row:
            _salt = row[0]
        else:
            _salt = os.urandom(16).hex()
            _conn.execute("INSERT INTO meta (key, value) VALUES ('salt', ?)", (_salt,))
        _conn.commit()
        logger.info("Usage counter ready at %s", path)
    except Exception:
        logger.exception("Failed to initialise usage counter; usage will not be recorded")
        _conn = None


def _client_type(user_agent: str) -> str:
    ua = user_agent.lower()
    if not ua:
        return "unknown"
    if any(s in ua for s in ("bot", "crawler", "spider", "preview", "monitor")):
        return "bot"
    if any(s in ua for s in ("curl", "wget", "python", "httpie", "postman", "go-http", "node-fetch", "axios")):
        return "script"
    if "mozilla" in ua:
        return "browser"
    return "other"


def client_ip(headers, fallback: str | None) -> str:
    """Real client IP, honouring the proxy's X-Forwarded-For header."""
    forwarded = headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return headers.get("x-real-ip") or fallback or ""


def record(endpoint: str, status: int, duration_ms: int, ip: str, origin: str | None, user_agent: str) -> None:
    """Record one request. Never raises: usage tracking must not break the API."""
    if _conn is None:
        return
    try:
        visitor = hashlib.sha256(f"{_salt}:{ip}".encode()).hexdigest()[:16]
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with _lock:
            _conn.execute(
                "INSERT INTO requests (ts, endpoint, status, duration_ms, visitor, origin, client) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ts, endpoint, status, duration_ms, visitor, origin, _client_type(user_agent)),
            )
            _conn.commit()
    except Exception:
        logger.exception("Failed to record usage")


def stats(days: int = 30) -> dict:
    """Summary of usage: all-time totals, a per-day breakdown and recent requests."""
    if _conn is None:
        return {"error": "usage counter not initialised"}

    since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    with _lock:
        cur = _conn.cursor()

        def totals(where: str = "", params: tuple = ()) -> dict:
            row = cur.execute(
                f"""
                SELECT COUNT(*),
                       COALESCE(SUM(status = 200), 0),
                       COUNT(DISTINCT visitor),
                       MIN(ts)
                FROM requests {where}
                """,
                params,
            ).fetchone()
            return {
                "requests": row[0],
                "successful": row[1],
                "unique_visitors": row[2],
                "first_seen": row[3],
            }

        all_time = totals()
        browsers_only = totals("WHERE client = 'browser'")

        by_endpoint = {
            endpoint: count
            for endpoint, count in cur.execute(
                "SELECT endpoint, COUNT(*) FROM requests GROUP BY endpoint ORDER BY 2 DESC"
            )
        }
        by_client = {
            client: count
            for client, count in cur.execute(
                "SELECT client, COUNT(*) FROM requests GROUP BY client ORDER BY 2 DESC"
            )
        }
        by_origin = {
            (origin or "none"): count
            for origin, count in cur.execute(
                "SELECT origin, COUNT(*) FROM requests GROUP BY origin ORDER BY 2 DESC LIMIT 20"
            )
        }
        daily = [
            {"date": d, "requests": r, "successful": s, "unique_visitors": u, "browser_requests": b}
            for d, r, s, u, b in cur.execute(
                """
                SELECT substr(ts, 1, 10) AS day, COUNT(*), SUM(status = 200),
                       COUNT(DISTINCT visitor), SUM(client = 'browser')
                FROM requests WHERE substr(ts, 1, 10) >= ?
                GROUP BY day ORDER BY day DESC
                """,
                (since,),
            )
        ]
        recent = [
            {"ts": ts, "endpoint": e, "status": st, "duration_ms": ms, "visitor": v, "origin": o, "client": c}
            for ts, e, st, ms, v, o, c in cur.execute(
                "SELECT ts, endpoint, status, duration_ms, visitor, origin, client "
                "FROM requests ORDER BY id DESC LIMIT 25"
            )
        ]

    return {
        "all_time": all_time,
        "browsers_only": browsers_only,
        "by_endpoint": by_endpoint,
        "by_client": by_client,
        "by_origin": by_origin,
        f"last_{days}_days": daily,
        "recent": recent,
    }


class Timer:
    """Tiny helper: `t = Timer(); ...; t.ms()`."""

    def __init__(self) -> None:
        self._start = time.perf_counter()

    def ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)
