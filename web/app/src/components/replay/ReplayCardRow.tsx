import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useReplayData } from '@/data/stats/useReplayData';
import { ReplayCard } from './ReplayCard';

interface ReplayCardRowProps {
  className?: string;
  showTitle?: boolean;
}

export const ReplayCardRow: React.FC<ReplayCardRowProps> = ({ className = '', showTitle = true }) => {
  const { cards, holder, memberSince, hasListeningData } = useReplayData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  if (!hasListeningData || cards.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className={`my-6 mx-(--body-gutter) ${className}`}>
      {showTitle && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-400" />
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-primary">
                Your listening experience
              </h2>
            </div>
            <p className="mt-0.5 text-xs md:text-sm text-secondary">
              Personalized highlights from your library and streaming activity
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/replay')}
              className="hidden sm:inline-flex items-center gap-1 rounded-full bg-quinary/70 hover:bg-quinary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors"
            >
              Open Replay
              <ChevronRight size={14} />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scroll('left')}
                className="grid size-8 place-items-center rounded-full bg-quinary/60 hover:bg-quinary text-secondary hover:text-primary transition-colors"
                aria-label="Previous cards"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scroll('right')}
                className="grid size-8 place-items-center rounded-full bg-quinary/60 hover:bg-quinary text-secondary hover:text-primary transition-colors"
                aria-label="Next cards"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className="w-[300px] flex-none snap-start"
          >
            <ReplayCard
              card={card}
              holder={holder}
              memberSince={memberSince}
              onClick={() => navigate('/replay')}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
