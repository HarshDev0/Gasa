import { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Player from './components/Player';
import Discovery from './components/Discovery';

const API = import.meta.env.VITE_API_URL;

function App() {
  // ── Single global audio element (prevents double-play bug) ──────────────
  const audioRef = useRef(new Audio());

  // ── Playback state ──────────────────────────────────────────────────────
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [audioUrl,    setAudioUrl]    = useState(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [duration,    setDuration]    = useState(0);

  // ── Queue state ─────────────────────────────────────────────────────────
  const [queue,      setQueue]      = useState([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const shuffledQueueRef            = useRef([]);

  // ── History for recommendations ─────────────────────────────────────────
  const [history, setHistory] = useState([]);

  // ── Wire up the single Audio element ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate  = () => { setProgress(audio.currentTime); setDuration(audio.duration || 0); };
    const onMetadata    = () => setDuration(audio.duration || 0);
    const onEnded       = () => skipNext();

    audio.addEventListener('timeupdate',     onTimeUpdate);
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('ended',          onEnded);

    return () => {
      audio.removeEventListener('timeupdate',     onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('ended',          onEnded);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause state → audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.play().catch(e => console.warn('Play blocked:', e));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Core play function ──────────────────────────────────────────────────
  const playSong = useCallback(async (song, newQueue = null, idx = -1) => {
    if (!song?.id) return;

    // Stop whatever is playing right now immediately
    const audio = audioRef.current;
    audio.pause();
    audio.src = '';
    setIsPlaying(false);
    setAudioUrl(null);
    setProgress(0);
    setDuration(0);

    setCurrentSong(song);
    setIsLoading(true);

    if (newQueue) {
      setQueue(newQueue);
      shuffledQueueRef.current = [...newQueue].sort(() => Math.random() - 0.5);
    }

    setHistory(prev => [song, ...prev.filter(s => s.id !== song.id)].slice(0, 20));

    try {
      const res  = await fetch(`${API}/api/stream/${song.id}`);
      const data = await res.json();
      if (data?.url) {
        // Enrich thumbnail if backend gave us a better one
        if (data.thumbnail) {
          setCurrentSong(prev => ({ ...prev, thumbnail: data.thumbnail }));
        }
        // Set src on the single global audio element and play
        audio.src = data.url;
        audio.load();
        setAudioUrl(data.url);
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(e => { console.warn('Play error:', e); setIsPlaying(false); });
      }
    } catch (err) {
      console.error('Failed to get stream url', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Skip helpers ────────────────────────────────────────────────────────
  const activeQueue = isShuffled ? shuffledQueueRef.current : queue;

  // Use a ref for skipNext so the audio 'ended' listener always has the latest
  const skipNextRef = useRef(null);

  const skipNext = useCallback(() => {
    if (!activeQueue.length) return;
    const idx     = activeQueue.findIndex(s => s.id === currentSong?.id);
    const nextIdx = (idx + 1) % activeQueue.length;
    playSong(activeQueue[nextIdx]);
  }, [activeQueue, currentSong, playSong]);

  const skipPrev = useCallback(() => {
    if (!activeQueue.length) return;
    // If more than 3 seconds in, restart. Otherwise go to previous.
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const idx     = activeQueue.findIndex(s => s.id === currentSong?.id);
    const prevIdx = (idx - 1 + activeQueue.length) % activeQueue.length;
    playSong(activeQueue[prevIdx]);
  }, [activeQueue, currentSong, playSong]);

  const toggleShuffle = useCallback(() => setIsShuffled(p => !p), []);

  const togglePlay = useCallback(() => {
    if (!audioUrl || isLoading) return;
    setIsPlaying(p => !p);
  }, [audioUrl, isLoading]);

  const seekTo = useCallback((pct) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = pct * duration;
    setProgress(pct * duration);
  }, [duration]);

  // Keep the ref in sync
  useEffect(() => { skipNextRef.current = skipNext; }, [skipNext]);

  // Patch the 'ended' listener to always call the latest skipNext
  useEffect(() => {
    const audio = audioRef.current;
    const onEnded = () => skipNextRef.current?.();
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  // ── Shared player props ─────────────────────────────────────────────────
  const playerProps = {
    currentSong,
    isPlaying,
    isLoading,
    audioUrl,
    progress,
    duration,
    isShuffled,
    onTogglePlay:   togglePlay,
    onNext:         skipNext,
    onPrev:         skipPrev,
    onToggleShuffle:toggleShuffle,
    onSeek:         seekTo,
  };

  return (
    <div className="min-h-screen bg-[#E4E4E4] font-sans overflow-hidden">

      {/* ── Mobile layout (< lg) ─────────────────────────────────── */}
      <div className="flex flex-col h-screen lg:hidden">
        <TopBar onPlaySong={playSong} setQueue={setQueue} />
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <Discovery
            onPlaySong={playSong}
            currentSong={currentSong}
            history={history}
            setQueue={setQueue}
          />
        </div>
        <div className="border-t-2 border-black bg-[#E4E4E4] px-4 pt-3 pb-5">
          <Player {...playerProps} compact />
        </div>
      </div>

      {/* ── Desktop layout (≥ lg) ────────────────────────────────── */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-16 xl:w-20 flex-shrink-0 flex flex-col items-center pt-6 gap-8 border-r border-black/10">
          <Sidebar />
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 xl:px-10 pt-6 pb-2 flex-shrink-0">
            <TopBar onPlaySong={playSong} setQueue={setQueue} />
          </div>

          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
            {/* Player panel */}
            <div className="col-span-4 border-r border-black/10 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 xl:px-8 py-4">
                <Player {...playerProps} />
              </div>
            </div>

            {/* Discovery panel */}
            <div className="col-span-8 overflow-y-auto px-6 xl:px-10 py-4">
              <Discovery
                onPlaySong={playSong}
                currentSong={currentSong}
                history={history}
                setQueue={setQueue}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
