import { useEffect, useState, useCallback, useRef } from 'react';
import { PlayCircle, Loader2, Music, RefreshCw } from 'lucide-react';

const API = "https://gasa-production.up.railway.app";;

function SongRow({ song, onPlay, isActive }) {
  return (
    <button
      onClick={() => onPlay(song)}
      className={`w-full flex items-center gap-4 group rounded-2xl px-3 py-2 -mx-3 transition-colors
        ${isActive ? 'bg-black/10' : 'hover:bg-black/5'}`}
    >
      {/* Thumb */}
      <div className="w-14 h-14 rounded-xl bg-black overflow-hidden flex-shrink-0 shadow-sm relative">
        {song.thumbnail
          ? <img src={song.thumbnail} alt="" className="w-full h-full object-cover opacity-85" />
          : <div className="w-full h-full flex items-center justify-center"><Music size={18} className="text-white/40" /></div>
        }
      </div>
      {/* Text */}
      <div className="flex-1 min-w-0 text-left">
        <p className={`font-pixel text-sm sm:text-base leading-tight truncate ${isActive ? 'text-black font-bold' : 'text-black'}`}>
          {song.title}
        </p>
        <p className="font-sans text-xs text-gray-500 font-medium truncate mt-0.5">{song.artist}</p>
      </div>
      {/* Play icon */}
      <PlayCircle
        size={28}
        strokeWidth={1.5}
        className={`flex-shrink-0 transition-transform ${isActive ? 'text-black scale-110' : 'text-gray-400 group-hover:text-black group-hover:scale-110'}`}
      />
    </button>
  );
}

function CategoryCard({ song, onPlay, isActive }) {
  return (
    <button
      onClick={() => onPlay(song)}
      className="flex flex-col items-center group cursor-pointer"
    >
      <div className={`w-full aspect-square rounded-2xl overflow-hidden bg-black mb-2 shadow-md ring-2 transition-all
        ${isActive ? 'ring-black scale-95' : 'ring-transparent group-hover:ring-black/30 group-hover:scale-[0.97]'}`}>
        {song?.thumbnail
          ? <img src={song.thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
          : <div className="w-full h-full flex items-center justify-center"><Music size={24} className="text-white/30" /></div>
        }
      </div>
      <span className="font-pixel text-xs sm:text-sm leading-tight truncate w-full text-center">{song?.title || '—'}</span>
      <span className="font-sans text-[11px] text-gray-500 font-medium truncate w-full text-center">{song?.artist || ''}</span>
    </button>
  );
}

export default function Discovery({ onPlaySong, currentSong, history, setQueue }) {
  const [categories,       setCategories]       = useState([]);
  const [activeCategory,   setActiveCategory]   = useState(null);
  const [categoryResults,  setCategoryResults]  = useState([]);
  const [catLoading,       setCatLoading]       = useState(false);
  const [upNext,           setUpNext]           = useState([]);
  const [upLoading,        setUpLoading]        = useState(false);
  const [featuredCards,    setFeaturedCards]    = useState([]);
  const prevSeedRef        = useRef(null);

  // ── Load categories list ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories || []);
        // Auto-load first category
        if (d.categories?.length) loadCategory(d.categories[0]);
      })
      .catch(console.error);
  }, []);

  const loadCategory = useCallback(async (cat) => {
    setActiveCategory(cat.id);
    setCatLoading(true);
    try {
      const res  = await fetch(`${API}/api/category/${cat.id}?limit=8`);
      const data = await res.json();
      setCategoryResults(data.results || []);
      setFeaturedCards((data.results || []).slice(0, 4));
    } catch (e) {
      console.error(e);
    } finally {
      setCatLoading(false);
    }
  }, []);

  // ── Up Next — refresh when current song changes ────────────────────────
  useEffect(() => {
    if (!currentSong?.id || currentSong.id === prevSeedRef.current) return;
    prevSeedRef.current = currentSong.id;

    setUpLoading(true);
    const params = new URLSearchParams({
      seed_id:    currentSong.id,
      seed_title: currentSong.title || '',
      limit:      '8',
    });
    fetch(`${API}/api/upnext?${params}`)
      .then(r => r.json())
      .then(d => {
        const songs = d.results || [];
        setUpNext(songs);
        setQueue(songs);
      })
      .catch(console.error)
      .finally(() => setUpLoading(false));
  }, [currentSong?.id]);

  // On initial load (no song) – fetch generic upnext
  useEffect(() => {
    if (currentSong) return;
    setUpLoading(true);
    fetch(`${API}/api/upnext?limit=8`)
      .then(r => r.json())
      .then(d => {
        setUpNext(d.results || []);
        setQueue(d.results || []);
      })
      .catch(console.error)
      .finally(() => setUpLoading(false));
  }, []);

  const handlePlayFromCategory = useCallback((song) => {
    onPlaySong(song, categoryResults, categoryResults.findIndex(s => s.id === song.id));
    setQueue(categoryResults);
  }, [categoryResults, onPlaySong, setQueue]);

  const handlePlayFromUpNext = useCallback((song) => {
    const idx = upNext.findIndex(s => s.id === song.id);
    onPlaySong(song, upNext, idx);
    setQueue(upNext);
  }, [upNext, onPlaySong, setQueue]);

  const refreshUpNext = () => {
    prevSeedRef.current = null;
    if (currentSong) {
      // force re-trigger
      prevSeedRef.current = null;
      setUpLoading(true);
      const params = new URLSearchParams({
        seed_id:    currentSong.id,
        seed_title: currentSong.title || '',
        limit:      '8',
      });
      fetch(`${API}/api/upnext?${params}`)
        .then(r => r.json())
        .then(d => { setUpNext(d.results || []); setQueue(d.results || []); })
        .catch(console.error)
        .finally(() => setUpLoading(false));
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-4">

      {/* ── Music Categories ─────────────────────────────────────────── */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-pixel text-3xl sm:text-4xl lg:text-5xl leading-[1.1]">
            Music<br />Categories
          </h2>
          <button className="font-sans font-bold text-sm underline underline-offset-2">View All</button>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => loadCategory(cat)}
              className={`px-5 py-2 rounded-full font-pixel text-sm sm:text-base tracking-wide transition-all
                ${activeCategory === cat.id
                  ? 'bg-black text-white scale-105 shadow-md'
                  : 'bg-white border-2 border-black text-black hover:bg-black hover:text-white'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Category cards grid */}
        {catLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-full aspect-square rounded-2xl bg-black/20 animate-pulse mb-2" />
                <div className="h-3 w-3/4 bg-black/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {featuredCards.map((song, i) => (
              <CategoryCard
                key={song?.id || i}
                song={song}
                onPlay={handlePlayFromCategory}
                isActive={currentSong?.id === song?.id}
              />
            ))}
          </div>
        )}

        {/* Remaining category songs as list */}
        {categoryResults.length > 4 && (
          <div className="mt-4 flex flex-col gap-1">
            {categoryResults.slice(4).map((song, i) => (
              <SongRow
                key={song.id || i}
                song={song}
                onPlay={handlePlayFromCategory}
                isActive={currentSong?.id === song.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Up Next ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-pixel text-3xl sm:text-4xl lg:text-5xl">Up next</h2>
          <button
            onClick={refreshUpNext}
            className="flex items-center gap-1.5 font-sans text-sm font-bold hover:opacity-70 transition"
            title="Refresh recommendations"
          >
            <RefreshCw size={14} className={upLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {upLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-black/20 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-black/20 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-black/10 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : upNext.length > 0 ? (
          <div className="flex flex-col gap-1">
            {upNext.map((song, i) => (
              <SongRow
                key={song.id || i}
                song={song}
                onPlay={handlePlayFromUpNext}
                isActive={currentSong?.id === song.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm font-sans py-6 text-center">
            Search or play a song to get recommendations
          </p>
        )}
      </section>
    </div>
  );
}
