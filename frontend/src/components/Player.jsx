import { useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Plus, Shuffle, Loader2, Music } from 'lucide-react';

export default function Player({
  currentSong,
  isPlaying,
  isLoading,
  audioUrl,
  progress,
  duration,
  isShuffled,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onSeek,
  compact = false,
}) {
  const waveRef = useRef(null);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleWaveClick = (e) => {
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  // Deterministic waveform bars
  const bars = Array.from({ length: compact ? 30 : 44 }, (_, i) =>
    12 + Math.abs(Math.sin(i * 0.85) * 12) + Math.abs(Math.cos(i * 0.35) * 6)
  );
  const progressPct = duration ? progress / duration : 0;

  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-5'} h-full select-none`}>

      {/* Album Art — desktop only */}
      {!compact && (
        <div className="bg-black rounded-3xl w-full aspect-square overflow-hidden shadow-2xl flex-shrink-0 relative group">
          {currentSong?.thumbnail ? (
            <img
              src={currentSong.thumbnail}
              alt="Album Art"
              className="w-full h-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center">
              <Music size={72} className="text-white/20" />
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 size={40} className="text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Song Info */}
      <div className={compact ? 'flex items-center gap-3' : ''}>
        {/* Compact thumbnail */}
        {compact && (
          <div className="w-12 h-12 rounded-xl bg-black overflow-hidden flex-shrink-0 relative">
            {currentSong?.thumbnail
              ? <img src={currentSong.thumbnail} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-white/40" /></div>
            }
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={14} className="text-white animate-spin" />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h2 className={`font-extrabold font-sans tracking-tight truncate leading-tight ${compact ? 'text-base' : 'text-2xl xl:text-3xl'}`}>
              {currentSong?.title || 'Nothing playing'}
            </h2>
            {!compact && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button className="bg-black text-white p-1 rounded-md hover:bg-gray-800 transition">
                  <Plus size={15} strokeWidth={3} />
                </button>
                <span className="text-base font-bold">347</span>
              </div>
            )}
          </div>
          <div className={compact ? 'mt-0.5' : 'mt-2'}>
            <span className={`inline-block bg-black text-white rounded-full font-bold tracking-wide ${compact ? 'px-3 py-0.5 text-[10px]' : 'px-4 py-1.5 text-xs'}`}>
              {currentSong?.artist || 'Unknown artist'}
            </span>
          </div>
        </div>
      </div>

      {/* Waveform / Scrub Bar */}
      <div className={`flex items-center gap-3 ${compact ? '' : 'mt-auto'}`}>
        <span className={`font-pixel flex-shrink-0 ${compact ? 'text-xs w-8' : 'text-base w-10'}`}>
          {formatTime(progress)}
        </span>

        <div
          ref={waveRef}
          className="flex-1 flex items-center justify-between h-10 cursor-pointer"
          onClick={handleWaveClick}
        >
          {bars.map((height, i) => {
            const active = (i / bars.length) <= progressPct;
            return (
              <div
                key={i}
                style={{
                  height: `${compact ? Math.round(height * 0.55) : height}px`,
                  width:  compact ? '2px' : '3px',
                }}
                className={`rounded-full flex-shrink-0 transition-colors duration-75 ${active ? 'bg-black' : 'bg-gray-400/60'}`}
              />
            );
          })}
        </div>

        <span className={`font-pixel flex-shrink-0 text-right ${compact ? 'text-xs w-8' : 'text-base w-10'}`}>
          {duration ? formatTime(duration) : (currentSong?.duration ? formatTime(currentSong.duration) : '0:00')}
        </span>
      </div>

      {/* Playback Controls */}
      <div className={`flex justify-center items-center ${compact ? 'gap-4' : 'gap-6 xl:gap-8'}`}>
        {/* Shuffle */}
        <button
          onClick={onToggleShuffle}
          className={`transition-all ${isShuffled ? 'text-black scale-110' : 'text-gray-400 hover:text-black'}`}
          title="Shuffle"
        >
          <Shuffle size={compact ? 16 : 18} />
        </button>

        {/* Prev */}
        <button
          onClick={onPrev}
          disabled={!currentSong}
          className="text-black hover:text-gray-500 transition disabled:opacity-30"
          title="Previous"
        >
          <SkipBack fill="currentColor" size={compact ? 18 : 22} />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          disabled={!audioUrl && !isLoading}
          className={`bg-black text-white rounded-full transition-all shadow-lg ${compact ? 'p-3' : 'p-4 xl:p-5'} hover:scale-105 active:scale-95 disabled:opacity-40`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading
            ? <Loader2 size={compact ? 18 : 22} className="animate-spin" />
            : isPlaying
              ? <Pause fill="currentColor" size={compact ? 18 : 22} />
              : <Play  fill="currentColor" size={compact ? 18 : 22} className="ml-0.5" />
          }
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={!currentSong}
          className="text-black hover:text-gray-500 transition disabled:opacity-30"
          title="Next"
        >
          <SkipForward fill="currentColor" size={compact ? 18 : 22} />
        </button>

        {/* Like — desktop only */}
        {!compact && (
          <button className="text-gray-400 hover:text-black transition" title="Add to liked">
            <Plus size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
