import { useState, useRef } from 'react';
import { Play, Pause, Sparkles, X } from 'lucide-react';

export function HeinekenMemorySection() {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ⭐ Heineken was founded in 1864 — update years automatically
  const FOUNDED_YEAR = 1864;
  const currentYear = new Date().getFullYear();
  const yearsOfHeineken = currentYear - FOUNDED_YEAR;

  const openVideo = () => {
    setShowVideo(true);
    setTimeout(() => videoRef.current?.play(), 100);
  };

  const closeVideo = () => {
    videoRef.current?.pause();
    setShowVideo(false);
  };

  return (
    <div className="mt-4 space-y-3 animate-slide-up">

      {/* ============ TOP RED BANNER ============ */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-[#007A33] to-[#007A33] shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative text-center">
          <p className="text-sm font-bold text-white leading-relaxed">
            We have been here for{' '}
            <span className="text-2xl font-black">{yearsOfHeineken}</span>{' '}
            years — celebrating moments that matter to you and yours.
          </p>
        </div>
      </div>

      {/* ============ VIDEO CARD ============ */}
      <button
        onClick={openVideo}
        className="w-full rounded-2xl overflow-hidden bg-black shadow-lg relative aspect-video group"
        aria-label="Play Heineken story video"
      >
        {/* Placeholder thumbnail */}
        <img
          src="/slideshow/slide.jpg"
          alt="Heineken story"
          className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          draggable={false}
        />

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[#007A33]/90 border-2 border-white/70 backdrop-blur-sm flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all">
            <Play size={26} className="text-white fill-white ml-1" />
          </div>
        </div>

        {/* Bottom label */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-2">
          <Sparkles size={14} className="text-[#00A04A] flex-shrink-0" />
          <span className="text-xs font-semibold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            Watch our story — {yearsOfHeineken} years of Heineken
          </span>
        </div>
      </button>

      {/* ============ STORY CARD (Image + Text) ============ */}
      <div className="rounded-2xl bg-white border border-[#E8EDE8] shadow-sm overflow-hidden">
        <div className="flex gap-3 p-3">
          {/* Left: image */}
          <div className="w-28 h-40 rounded-xl overflow-hidden flex-shrink-0 border border-[#E8EDE8] bg-[#F5F7F5]">
            <img
              src="/slideshow/slide.jpg"
              alt="Heineken story"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Right: text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#0A2A1A] mb-2 leading-snug">
              {yearsOfHeineken} Years of Unforgettable Memories
            </h3>
            <p className="text-[11px] text-[#4A5A50] leading-relaxed">
              For {yearsOfHeineken} years, you've welcomed Heineken into the moments that matter most.
              Celebrations filled with cheers, weddings that marked new beginnings,
              victories that brought friends together, birthdays overflowing with laughter,
              and countless everyday memories that have become treasured stories over time.
            </p>
          </div>
        </div>
      </div>

      {/* ============ VIDEO MODAL (fullscreen player) ============ */}
      {showVideo && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4"
          onClick={closeVideo}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src="/slideshow/heineken-story.mp4"
              controls
              playsInline
              className="w-full rounded-2xl shadow-2xl bg-black"
            />
            <button
              onClick={closeVideo}
              aria-label="Close video"
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-[#007A33] border-2 border-white flex items-center justify-center text-white shadow-lg hover:bg-[#005A26] transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}