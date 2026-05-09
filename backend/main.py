from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
import asyncio
import os
import base64
import tempfile
import atexit

app = FastAPI(title="GASA Music Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cookie setup ──────────────────────────────────────────────────────────────
# In Railway dashboard, set:  YT_COOKIES_B64 = <base64 of your cookies.txt>
# On Mac:    base64 -i cookies.txt | pbcopy
# On Linux:  base64 -w 0 cookies.txt
_COOKIE_FILE: str | None = None

def _init_cookies():
    global _COOKIE_FILE
    b64 = os.environ.get("YT_COOKIES_B64", "").strip()
    if not b64:
        print("[cookies] YT_COOKIES_B64 not set — running without cookies (may get bot-detected)")
        return
    try:
        data = base64.b64decode(b64)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="wb")
        tmp.write(data)
        tmp.close()
        _COOKIE_FILE = tmp.name
        print(f"[cookies] Loaded cookies → {_COOKIE_FILE}")
    except Exception as e:
        print(f"[cookies] Failed to decode YT_COOKIES_B64: {e}")

_init_cookies()

def _cleanup_cookies():
    if _COOKIE_FILE and os.path.exists(_COOKIE_FILE):
        os.unlink(_COOKIE_FILE)

atexit.register(_cleanup_cookies)


def _base_opts(**extra) -> dict:
    """Shared yt-dlp options; injects cookiefile when available."""
    opts = {"quiet": True, "no_warnings": True, **extra}
    if _COOKIE_FILE:
        opts["cookiefile"] = _COOKIE_FILE
    return opts


# ── Category definitions ───────────────────────────────────────────────────────
CATEGORIES = [
    {"id": "classic",      "name": "Classic",      "query": "classic rock hits",   "color": "#1a1a1a"},
    {"id": "90s",          "name": "90's",          "query": "90s pop hits",        "color": "#1a1a1a"},
    {"id": "new",          "name": "New",           "query": "top hits 2024",       "color": "#1a1a1a"},
    {"id": "instrumental", "name": "Instrumental",  "query": "instrumental music",  "color": "#1a1a1a"},
    {"id": "hiphop",       "name": "Hip Hop",       "query": "hip hop hits",        "color": "#1a1a1a"},
    {"id": "chill",        "name": "Chill",         "query": "chill lofi music",    "color": "#1a1a1a"},
]

CATEGORY_MAP = {c["id"]: c for c in CATEGORIES}


# ── yt-dlp helpers ─────────────────────────────────────────────────────────────

def _ydl_search(query: str, max_results: int = 8):
    """Synchronous yt-dlp search — returns list of track dicts."""
    opts = _base_opts(
        format="bestaudio/best",
        noplaylist=True,
        extract_flat=True,   # fast: no full page load
    )
    skip_keywords = {"similar", "playlist", "mix", "hits", "top", "lofi", "compilation"}
    if not any(kw in query.lower() for kw in skip_keywords):
        query += " official audio"

    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            result = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
            if "entries" not in result:
                return []
            tracks = []
            for entry in result["entries"]:
                if not entry or not entry.get("id"):
                    continue
                thumbs = entry.get("thumbnails") or []
                thumb  = thumbs[-1].get("url") if thumbs else None
                tracks.append({
                    "id":        entry.get("id"),
                    "title":     entry.get("title"),
                    "artist":    entry.get("uploader") or entry.get("channel"),
                    "thumbnail": thumb,
                    "duration":  entry.get("duration"),
                })
            return tracks
        except Exception as e:
            print(f"[yt-dlp search error] {e}")
            return []


def _ydl_stream(video_id: str):
    """Synchronous extraction of the best-audio direct URL."""
    opts = _base_opts(format="bestaudio/best")
    # Always pass a full URL — bare video IDs cause 404s
    url = f"https://www.youtube.com/watch?v={video_id}" if not video_id.startswith("http") else video_id
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            thumbs = info.get("thumbnails") or []
            thumb  = thumbs[-1].get("url") if thumbs else None
            return {
                "url":       info.get("url"),
                "thumbnail": thumb,
                "duration":  info.get("duration"),
            }
        except Exception as e:
            print(f"[yt-dlp stream error] {e}")
            return None


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search(q: str, limit: int = 8):
    """Full-text search; returns list of tracks without starting playback."""
    results = await asyncio.to_thread(_ydl_search, q, limit)
    return {"results": results}


@app.get("/api/stream/{video_id}")
async def stream(video_id: str):
    """Resolve a direct audio stream URL for the given YouTube video ID."""
    data = await asyncio.to_thread(_ydl_stream, video_id)
    if data and data.get("url"):
        return data
    raise HTTPException(status_code=404, detail="Stream URL not found")


@app.get("/api/categories")
async def categories():
    return {"categories": CATEGORIES}


@app.get("/api/category/{category_id}")
async def category_songs(category_id: str, limit: int = 8):
    cat = CATEGORY_MAP.get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    results = await asyncio.to_thread(_ydl_search, cat["query"], limit)
    return {"results": results, "category": cat}


def _parse_upnext_queries(seed_title: str | None, seed_artist: str | None) -> list[str]:
    noise = {"official", "audio", "video", "lyrics", "ft", "feat", "hd", "mv", "4k", "live"}
    queries = []
    if seed_artist:
        queries.append(f"{seed_artist} best songs")
    if seed_title:
        clean = " ".join(w for w in seed_title.split() if w.lower() not in noise)
        short = " ".join(clean.split()[:3])
        queries.append(f"{short} similar artists mix")
    return queries or ["top music hits"]


@app.get("/api/upnext")
async def upnext(
    seed_id:     str | None = None,
    seed_title:  str | None = None,
    seed_artist: str | None = None,
    limit:       int = 8,
):
    """Smart Up Next — related but distinct songs, interleaved from parallel searches."""
    if not seed_title and not seed_id:
        results = await asyncio.to_thread(_ydl_search, "top music hits mix", limit)
        return {"results": results[:limit]}

    queries = _parse_upnext_queries(seed_title, seed_artist)
    per_query = max(5, (limit // len(queries)) + 3)

    tasks = [asyncio.to_thread(_ydl_search, q, per_query) for q in queries]
    buckets = list(await asyncio.gather(*tasks))

    seen: set[str] = {seed_id} if seed_id else set()
    interleaved: list[dict] = []
    while len(interleaved) < limit and any(b for b in buckets):
        for bucket in buckets:
            if bucket and len(interleaved) < limit:
                track = bucket.pop(0)
                tid = track.get("id")
                if tid and tid not in seen:
                    seen.add(tid)
                    interleaved.append(track)

    return {"results": interleaved[:limit]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
