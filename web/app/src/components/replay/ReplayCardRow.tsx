import React, { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useReplayData } from '@/data/stats/useReplayData';
import { ReplayCard } from './ReplayCard';

interface ReplayCardRowProps {
  className?: string;
}

export const ReplayCardRow: React.FC<ReplayCardRowProps> = ({ className = '' }) => {
  const { cards, holder, memberSince, hasListeningData } = useReplayData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  if (!hasListeningData || cards.length === 0) return null;

  return (
    <section className={`my-4 mx-(--body-gutter) ${className}`}>

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
