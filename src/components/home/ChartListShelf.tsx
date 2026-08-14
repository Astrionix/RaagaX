import React from 'react';
import { ShelfItem } from '@/types/home';
import { Play, MoreHorizontal } from 'lucide-react';

export function ChartListShelf({ title, items }: { title: string; items: ShelfItem[] }) {
  return (
    <section className="mb-4 sm:mb-6 w-full max-w-4xl px-3 sm:px-0">
      <h2 className="text-[20px] sm:text-xl font-semibold leading-[26px] text-white tracking-tight cursor-pointer truncate whitespace-nowrap mb-2.5">
        {title}
      </h2>
      <div className="flex flex-col gap-1">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="w-6 text-center text-sm font-semibold text-slate-400 group-hover:text-white">
              <span className="group-hover:hidden">{index + 1}</span>
              <Play className="w-4 h-4 hidden group-hover:block mx-auto fill-current" />
            </div>
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-10 h-10 rounded shadow-sm object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
              <p className="text-xs text-slate-400 truncate hover:underline hover:text-slate-300">
                {item.subtitle}
              </p>
            </div>
            <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white p-2">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
