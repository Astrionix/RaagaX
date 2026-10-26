import React, { useRef } from 'react';
import type { ReplayHeroCard } from '@/data/stats/useReplayData';

interface ReplayCardProps {
  card: ReplayHeroCard;
  holder: string;
  memberSince: string;
  onClick?: () => void;
  className?: string;
}

const GRADIENTS: Record<ReplayHeroCard['page'], string> = {
  minutes: 'from-[#2a0845] via-[#6441a5] to-[#fe8c00]',
  songs: 'from-[#0f2027] via-[#203a43] to-[#2c5364]',
  artists: 'from-[#3a1c71] via-[#d76d77] to-[#ffaf7b]',
  albums: 'from-[#1a2a6c] via-[#b21f1f] to-[#fdbb2d]',
  summary: 'from-[#141e30] via-[#243b55] to-[#00b4db]',
};

export const ReplayCard: React.FC<ReplayCardProps> = ({ card, holder, memberSince, onClick, className = '' }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--spot-x', `${x}px`);
    el.style.setProperty('--spot-y', `${y}px`);
  };

  const gradientClass = GRADIENTS[card.page] || GRADIENTS.summary;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      style={{ aspectRatio: '1.586 / 1' }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] p-5 select-none
        border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.55)] cursor-pointer
        hover:scale-[1.025] hover:border-white/25 active:scale-[0.985]
        transition-all duration-300 ease-out bg-black ${className}`}
    >
      {/* Blurred artwork backdrop if present */}
      {card.artworkUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125 transition-opacity duration-700"
          style={{ backgroundImage: `url(${card.artworkUrl})` }}
        />
      )}

      {/* Vibrant Mesh Gradient layer */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-85 mix-blend-screen pointer-events-none`} />

      {/* Vertical dark gradient scrim for contrast and legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/75 pointer-events-none" />

      {/* Dynamic specular mouse sheen */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255, 255, 255, 0.18), transparent 75%)',
        }}
      />

      {/* Top Bar: "YOUR LISTENING EXPERIENCE" + Raaga Logo */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80 leading-tight">
          Your listening experience
        </span>
        <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
          <img
            src="/raaga_logo_mark.png"
            alt="Raaga"
            className="w-5 h-auto object-contain brightness-200 contrast-125"
          />
        </div>
      </div>

      {/* Center Section: Main headline and category label */}
      <div className="relative z-10 my-auto py-2">
        <h3
          className="text-[25px] sm:text-[27px] font-extrabold leading-[1.12] line-clamp-2
            bg-gradient-to-b from-white via-[#f3f4f8] to-[#c9ccd6] bg-clip-text text-transparent
            drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
        >
          {card.value}
        </h3>
        <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/70">
          {card.label}
        </p>
      </div>

      {/* Bottom Bar: Holder Name, Details, Member Since */}
      <div className="relative z-10 flex items-end justify-between gap-4 pt-1">
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-[12px] font-semibold tracking-[0.08em] uppercase text-white/95 truncate
              drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          >
            {holder}
          </div>
          <div className="text-[11px] text-white/65 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {card.detail}
          </div>
        </div>

        {memberSince && (
          <div className="flex-none text-right">
            <div className="text-[7.5px] font-semibold uppercase tracking-[0.1em] text-white/55">
              Member Since
            </div>
            <div
              className="font-mono text-[11.5px] font-semibold tracking-wider text-white/95
                drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            >
              {memberSince}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
