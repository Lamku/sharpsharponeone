export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: { box: 'w-9 h-9', text: 'text-lg' },
    md: { box: 'w-11 h-11', text: 'text-xl' },
    lg: { box: 'w-16 h-16', text: 'text-2xl' },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dims.box} rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0`}>
        <img
          src="/logo.jpg"
          alt="Sharpsharpone"
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
      <span className={`${dims.text} font-display font-extrabold tracking-tight text-white`}>
        Sharp<span className="text-gold">sharpone</span>
      </span>
    </div>
  );
}