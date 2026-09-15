import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/+BHDMWqhc2uJjNDM0';
const STORAGE_KEY = 'telegram_btn_pos';

export function TelegramButton() {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 200 };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      } catch {}
    }
    return { x: 20, y: 200 };
  });

  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Clamp position within viewport
  const clamp = (x: number, y: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = 56;
    return {
      x: Math.max(8, Math.min(x, w - size - 8)),
      y: Math.max(8, Math.min(y, h - size - 8)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragging.current = true;
    moved.current = false;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      offset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    moved.current = true;

    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;
    const clamped = clamp(newX, newY);
    setPos(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (moved.current) {
      // Persist position after a drag
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } else {
      // It was a tap → open Telegram
      window.open(TELEGRAM_URL, '_blank', 'noopener,noreferrer');
    }
  };

  // Keep button inside viewport on resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => clamp(p.x, p.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: 'none',
      }}
      className="fixed z-[45] w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 border border-sky-400/40 shadow-lg shadow-sky-500/30 flex items-center justify-center text-white active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
      aria-label="Join our Telegram group"
      title="Join our Telegram group"
    >
      <Send size={22} />
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full animate-ping bg-sky-500/30 pointer-events-none" />
    </button>
  );
}