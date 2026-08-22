'use client';

import React, { useState, useRef } from 'react';
import { HeartOff, Trash2, MinusCircle } from 'lucide-react';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface SwipeableSongRowProps {
  song: Song;
  onSwipeAction?: () => void;
  actionType?: 'unlike' | 'remove_download' | 'remove_playlist' | 'remove';
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 75;
const MAX_SWIPE = 140;

export function SwipeableSongRow({
  song,
  onSwipeAction,
  actionType = 'unlike',
  actionLabel,
  actionIcon,
  children,
  disabled = false,
  className = '',
}: SwipeableSongRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [hasCrossedThreshold, setHasCrossedThreshold] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const hasSwipedRef = useRef<boolean>(false);
  const swipeCooldownTimer = useRef<NodeJS.Timeout | null>(null);

  // Default Action Labels & Icons based on type
  const getActionConfig = () => {
    switch (actionType) {
      case 'unlike':
        return {
          label: actionLabel || 'Remove',
          icon: actionIcon || <HeartOff className="w-5 h-5 text-white" />,
          bgColor: 'bg-gradient-to-l from-red-600 via-rose-600 to-red-700',
        };
      case 'remove_download':
        return {
          label: actionLabel || 'Remove Download',
          icon: actionIcon || <Trash2 className="w-5 h-5 text-white" />,
          bgColor: 'bg-gradient-to-l from-red-600 via-rose-600 to-red-700',
        };
      case 'remove_playlist':
        return {
          label: actionLabel || 'Remove',
          icon: actionIcon || <Trash2 className="w-5 h-5 text-white" />,
          bgColor: 'bg-gradient-to-l from-red-600 via-rose-600 to-red-700',
        };
      case 'remove':
      default:
        return {
          label: actionLabel || 'Remove',
          icon: actionIcon || <MinusCircle className="w-5 h-5 text-white" />,
          bgColor: 'bg-gradient-to-l from-red-600 via-rose-600 to-red-700',
        };
    }
  };

  const config = getActionConfig();

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRemoving) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    hasSwipedRef.current = false;
    if (swipeCooldownTimer.current) {
      clearTimeout(swipeCooldownTimer.current);
      swipeCooldownTimer.current = null;
    }
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null || disabled || isRemoving) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Detect primary direction
    if (isHorizontal.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontal.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only swipe horizontally to the left (negative diffX)
    if (isHorizontal.current) {
      hasSwipedRef.current = true;
      if (diffX < 0) {
        // Resistance curve
        const clampedOffset = Math.max(-MAX_SWIPE, diffX * 0.85);
        setOffsetX(clampedOffset);

        const crossed = Math.abs(clampedOffset) >= SWIPE_THRESHOLD;
        if (crossed && !hasCrossedThreshold) {
          haptics.mediumImpact();
          setHasCrossedThreshold(true);
        } else if (!crossed && hasCrossedThreshold) {
          setHasCrossedThreshold(false);
        }
      } else {
        // Slight resistance if dragging to the right
        setOffsetX(Math.min(20, diffX * 0.2));
      }
    }
  };

  const executeAction = () => {
    setIsRemoving(true);
    setOffsetX(-window.innerWidth);
    haptics.mediumImpact();
    setTimeout(() => {
      onSwipeAction?.();
    }, 280);
  };

  const handleTouchEnd = () => {
    if (disabled || isRemoving) return;
    setIsSwiping(false);

    if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
      if (actionType === 'remove_download') {
        // Require lightweight confirmation before deleting local physical file
        setShowConfirmModal(true);
        haptics.warningImpact();
      } else {
        executeAction();
      }
    } else {
      // Spring back to center
      setOffsetX(0);
      setHasCrossedThreshold(false);
    }

    startX.current = null;
    startY.current = null;
    isHorizontal.current = null;

    // Keep hasSwipedRef active for 250ms to suppress accidental child click events
    swipeCooldownTimer.current = setTimeout(() => {
      hasSwipedRef.current = false;
    }, 250);
  };

  const handleCaptureClick = (e: React.MouseEvent) => {
    if (hasSwipedRef.current || offsetX !== 0) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  if (isRemoving) {
    return (
      <div className="overflow-hidden transition-all duration-300 ease-out max-h-0 opacity-0 mb-0 pointer-events-none scale-95" />
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl select-none group/swipe ${className}`}>
      {/* ── Background Action Reveal Panel ── */}
      <div
        className={`absolute inset-0 flex items-center justify-end px-5 rounded-2xl ${config.bgColor} transition-opacity duration-200 ${
          offsetX < -10 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (actionType === 'remove_download') {
              setShowConfirmModal(true);
              haptics.warningImpact();
            } else {
              executeAction();
            }
          }}
          className={`flex items-center gap-2 text-white font-black text-xs uppercase tracking-wider transition-transform duration-200 cursor-pointer ${
            hasCrossedThreshold ? 'scale-110 translate-x-0' : 'scale-95 translate-x-1 opacity-90'
          }`}
        >
          {config.icon}
          <span>{config.label}</span>
        </button>
      </div>

      {/* ── Foreground Song Item Surface ── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClickCapture={handleCaptureClick}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
        }}
        className="relative z-10 w-full bg-inherit"
      >
        {children}
      </div>

      {/* ── Lightweight Confirmation Modal for Download Removal ── */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirmModal(false);
            setOffsetX(0);
            setHasCrossedThreshold(false);
          }}
        >
          <div
            className="bg-[#181920] border border-white/10 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-black text-white">Remove Download?</h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  Delete &quot;{song.title}&quot; from offline storage?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setOffsetX(0);
                  setHasCrossedThreshold(false);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  executeAction();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-red-600/30 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
