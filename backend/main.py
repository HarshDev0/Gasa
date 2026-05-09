from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
import asyncio
import random
import os

cookies = os.getenv("YOUTUBE_COOKIES")

if cookies:
    with open("cookies.txt", "w", encoding="utf-8") as f:
        f.write(cookies)

app = FastAPI(title="GASA Music Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Category definitions ---
CATEGORIES = [
    {"id": "classic", "name": "Classic",      "query": "classic rock hits",      "color": "#1a1a1a"},
    {"id": "90s",     "name": "90's",          "query": "90s pop hits",            "color": "#1a1a1a"},
    {"id": "new",     "name": "New",           "query": "top hits 2024",           "color": "#1a1a1a"},
    {"id": "instrumental", "name": "Instrumental", "query": "instrumental music",  "color": "#1a1a1a"},
    {"id": "hiphop",  "name": "Hip Hop",       "query": "hip hop hits",            "color": "#1a1a1a"},
    {"id": "chill",   "name": "Chill",         "query": "chill lofi music",        "color": "#1a1a1a"},
]

CATEGORY_MAP = {c["id"]: c for c in CATEGORIES}


def _ydl_search(query: str, max_results: int = 8):
    """Synchronous yt-dlp search – returns list of track dicts."""
    ydl_opts = {
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,

    "cookiefile": "cookies.txt",

    "extractor_args": {
        "youtube": {
            "player_client": ["android"]
        }
    },

    "http_headers": {
        "User-Agent": "Mozilla/5.0"
    }
}
    # Prefer official uploads: append 'official audio' unless it's already a
    # genre/category query that would look odd with it
    skip_keywords = {"similar", "playlist", "mix", "hits", "top", "lofi", "compilation"}
    if not any(kw in query.lower() for kw in skip_keywords):
        query += " official audio"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
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
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(video_id, download=False)
            # Also grab the real thumbnail/duration in case flat-extract missed them
            thumbs = info.get("thumbnails") or []
            thumb = thumbs[-1].get("url") if thumbs else None
            return {
                "url":       info.get("url"),
                "thumbnail": thumb,
                "duration":  info.get("duration"),
            }
        except Exception as e:
            print(f"[yt-dlp stream error] {e}")
            return None


# ── Routes ──────────────────────────────────────────────────────────────────

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
    """Return songs for a given category pill."""
    cat = CATEGORY_MAP.get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    results = await asyncio.to_thread(_ydl_search, cat["query"], limit)
    return {"results": results, "category": cat}


@app.get("/api/upnext")
async def upnext(seed_id: str | None = None, seed_title: str | None = None, limit: int = 8):
    """
    Smart 'Up Next' that returns recommendations.
    - If a seed song is known, search for similar songs by title.
    - Falls back to a popular hits mix.
    """
    if seed_title:
        # simple similarity: search variations of the title
        query = f"{seed_title} similar songs playlist"
    elif seed_id:
        query = f"ytsearch1:https://www.youtube.com/watch?v={seed_id}"
    else:
        query = "top music hits mix"

    results = await asyncio.to_thread(_ydl_search, query, limit)
    # Remove the seed song itself from the list
    if seed_id:
        results = [r for r in results if r.get("id") != seed_id]
    return {"results": results[:limit]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
    app,
    host="0.0.0.0",
    port=int(os.environ.get("PORT", 8000))
)
