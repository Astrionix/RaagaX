'use client';

import React, { useState } from 'react';
import { Delete, CornerDownLeft, ArrowUp, Hash, Type, X } from 'lucide-react';

interface TVOnScreenKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  fieldName?: string;
  isPassword?: boolean;
}

export function TVOnScreenKeyboard({
  value,
  onChange,
  onSubmit,
  onClose,
  fieldName = 'Field',
  isPassword = false,
}: TVOnScreenKeyboardProps) {
  const [layout, setLayout] = useState<'lowercase' | 'uppercase' | 'numbers' | 'symbols'>('lowercase');

  const lowercaseKeys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '-'],
  ];

  const uppercaseKeys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '@'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '_', '-'],
  ];

  const numberSymbolKeys = [
    ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
    ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
    [';', ':', "'", '"', ',', '.', '<', '>', '/', '?'],
    ['~', '`', '1', '2', '3', '4', '5', '6', '7', '8'],
  ];

  const currentKeys =
    layout === 'uppercase'
      ? uppercaseKeys
      : layout === 'symbols' || layout === 'numbers'
      ? numberSymbolKeys
      : lowercaseKeys;

  const handleKeyPress = (char: string) => {
    onChange(value + char);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/85 backdrop-blur-3xl flex flex-col justify-end p-6 sm:p-10 select-none animate-in slide-in-from-bottom-8 duration-300">
      <div className="bg-white/10 border border-white/15 backdrop-blur-3xl rounded-3xl p-6 sm:p-8 max-w-5xl mx-auto w-full shadow-[0_30px_90px_rgba(0,0,0,0.9)] text-white space-y-5 relative">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#fa233b]">TV Keyboard • {fieldName}</span>
            <div className="text-xl sm:text-2xl font-mono font-black tracking-wider text-white mt-1">
              {isPassword ? '•'.repeat(value.length) || <span className="text-white/30 italic">Enter password...</span> : value || <span className="text-white/30 italic">Type value...</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              data-tv-focusable="true"
              onClick={handleClear}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white/80 transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              data-tv-focusable="true"
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
              aria-label="Close TV Keyboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KEY GRID */}
        <div className="space-y-2.5">
          {currentKeys.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-2">
              {row.map((keyChar, kIdx) => (
                <button
                  key={kIdx}
                  data-tv-focusable="true"
                  onClick={() => handleKeyPress(keyChar)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 hover:bg-white/25 active:bg-[#fa233b] text-lg sm:text-xl font-bold text-white transition-all flex items-center justify-center cursor-pointer border border-white/10"
                >
                  {keyChar}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* BOTTOM ACTION ROW */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              data-tv-focusable="true"
              onClick={() => setLayout(layout === 'uppercase' ? 'lowercase' : 'uppercase')}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                layout === 'uppercase' ? 'bg-[#fa233b] text-white border-red-400' : 'bg-white/10 hover:bg-white/20 text-white/80 border-white/10'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
              <span>Shift</span>
            </button>

            <button
              data-tv-focusable="true"
              onClick={() => setLayout(layout === 'symbols' ? 'lowercase' : 'symbols')}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                layout === 'symbols' ? 'bg-[#fa233b] text-white border-red-400' : 'bg-white/10 hover:bg-white/20 text-white/80 border-white/10'
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>123 / #@$</span>
            </button>

            <button
              data-tv-focusable="true"
              onClick={() => handleKeyPress(' ')}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer border border-white/10"
            >
              Space
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              data-tv-focusable="true"
              onClick={handleBackspace}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer flex items-center gap-2 border border-white/10"
            >
              <Delete className="w-4 h-4" />
              <span>Backspace</span>
            </button>

            <button
              data-tv-focusable="true"
              onClick={onSubmit}
              className="px-8 py-3 bg-[#fa233b] hover:bg-[#d91e32] rounded-2xl text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-red-500/30 transition-all cursor-pointer flex items-center gap-2"
            >
              <CornerDownLeft className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
