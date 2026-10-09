export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: { box: 'w-12 h-12', text: 'text-2xl' },
    md: { box: 'w-14 h-14', text: 'text-3xl' },
    lg: { box: 'w-20 h-20', text: 'text-4xl' },
  }[size];

  return (
    <div className="flex items-center gap-3">
      <div className={`${dims.box} rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <img
          src="/logo.png"
          alt="Heineken"
          className="w-full h-full object-cover"
          style={{
            imageRendering: '-webkit-optimize-contrast',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
          }}
          loading="eager"
          decoding="async"
        />
      </div>
      <span className={`${dims.text} font-display font-black tracking-tight text-[#0A2A1A] leading-none`}>
        Heine<span className="text-[#007A33]">ken</span>
      </span>
    </div>
  );
}