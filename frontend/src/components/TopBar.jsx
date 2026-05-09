import { Search, UserCircle2, X, Music } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

const API = "https://gasa-production.up.railway.app";;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TopBar({ onPlaySong, setQueue }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [showDropdown,setShowDropdown]= useState(false);
  const containerRef  = useRef(null);
  const debouncedQ    = useDebounce(query, 350);

  // Fetch as user types
  useEffect(() => {
    if (!debouncedQ.trim()) { setResults([]); setShowDropdown(false); return; }
    setIsLoading(true);
    fetch(`${API}/api/search?q=${encodeURIComponent(debouncedQ)}&limit=6`)
      .then(r => r.json())
      .then(d => {
        setResults(d.results || []);
        setShowDropdown(true);
      })
      .catch(() => setResults([]))
      .finally(() => setIsLoading(false));
  }, [debouncedQ]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((song) => {
    // Add all search results to queue, starting with selected
    const idx = results.findIndex(s => s.id === song.id);
    onPlaySong(song, results, idx >= 0 ? idx : 0);
    setQueue(results);
    setShowDropdown(false);
    setQuery('');
  }, [results, onPlaySong, setQueue]);

  const clearSearch = () => { setQuery(''); setResults([]); setShowDropdown(false); };

  const formatDuration = (sec) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 md:gap-6 w-full relative z-50">
      {/* Logo — visible on desktop (sidebar hides it on ≥lg already) */}
      <h1 className="font-pixel text-4xl md:text-5xl tracking-widest flex-shrink-0 hidden lg:block">GASA</h1>

      {/* Search */}
      <div ref={containerRef} className="flex-1 relative max-w-2xl mx-auto lg:mx-0">
        <div className="relative flex items-center">
          <Search className="absolute left-4 text-black pointer-events-none" size={18} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="Search for songs, artists…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length && setShowDropdown(true)}
            className="w-full bg-white rounded-full border-2 border-black py-2.5 pl-11 pr-10 text-base font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/30 transition"
          />
          {query && (
            <button onClick={clearSearch} className="absolute right-4 text-gray-400 hover:text-black transition">
              <X size={16} />
            </button>
          )}
          {isLoading && (
            <div className="absolute right-10 w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white border-2 border-black rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {results.map((song, i) => (
                <button
                  key={song.id || i}
                  onClick={() => handleSelect(song)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#E4E4E4] transition text-left group"
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 flex-shrink-0 bg-black rounded-lg overflow-hidden">
                    {song.thumbnail
                      ? <img src={song.thumbnail} alt="" className="w-full h-full object-cover opacity-90" />
                      : <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-white/50" /></div>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-black truncate">{song.title}</p>
                    <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                  </div>
                  {/* Duration */}
                  <span className="text-xs text-gray-400 flex-shrink-0 font-pixel">
                    {formatDuration(song.duration)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <button className="flex-shrink-0 ml-auto">
        <UserCircle2 size={36} className="text-black" strokeWidth={1.5} />
      </button>
    </div>
  );
}
