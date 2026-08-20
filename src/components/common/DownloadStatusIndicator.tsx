'use client';

import React from 'react';
import { ArrowDown, Check, Loader2, Pause, AlertCircle } from 'lucide-react';
import { Song } from '@/types/music';
import { useDownloadStore, DownloadStatus } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';

interface DownloadStatusIndicatorProps {
  song: Song;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
  onDownloadedClick?: () => void;
}

export function DownloadStatusIndicator({
  song,
  size = 'sm',
  showPercentage = false,
  className = 'md:hidden',
  onDownloadedClick,
}: DownloadStatusIndicatorProps) {
  const tasks = useDownloadStore((s) => s.tasks);
  const nativeTracks = useDownloadStore((s) => s.nativeDownloadedTracks);
  const saveForOffline = useDownloadStore((s) => s.saveForOffline);
  const retryDownload = useDownloadStore((s) => s.retryDownload);
  const downloadedSongIds = usePlayerStore((s) => s.downloadedSongIds);

  if (!song || !song.id) return null;

  const task = tasks[song.id];
  const isDownloaded = downloadedSongIds.includes(song.id) || !!nativeTracks[song.id];

  // Resolve status accurately
  let status: DownloadStatus = 'NOT_DOWNLOADED';
  let progress = 0;

  if (task) {
    status = task.status;
    progress = task.progress || 0;
  } else if (isDownloaded) {
    status = 'COMPLETED';
    progress = 100;
  }

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const containerSizes = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'NOT_DOWNLOADED') {
      saveForOffline(song);
    } else if (status === 'FAILED') {
      retryDownload(song.id);
    } else if (status === 'COMPLETED' && onDownloadedClick) {
      onDownloadedClick();
    }
  };

  if (status === 'COMPLETED') {
    return (
      <div
        onClick={handleClick}
        title="Downloaded to this device (Music/RaagaX)"
        className={`inline-flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold transition-all flex-shrink-0 ${containerSizes[size]} ${className}`}
      >
        <Check className={`${iconSizes[size]} stroke-[3]`} />
      </div>
    );
  }

  if (status === 'DOWNLOADING' || status === 'VERIFYING') {
    const isVerifying = status === 'VERIFYING';
    const radius = 9;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.max(5, progress) / 100) * circumference;

    return (
      <div
        onClick={handleClick}
        title={isVerifying ? 'Verifying tags...' : `Downloading • ${progress}%`}
        className={`inline-flex items-center gap-1 text-[#fa233b] font-mono font-bold transition-all flex-shrink-0 ${className}`}
      >
        <div className={`relative flex items-center justify-center ${containerSizes[size]}`}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 22 22">
            <circle
              cx="11"
              cy="11"
              r={radius}
              className="stroke-white/15 fill-none"
              strokeWidth="2.5"
            />
            <circle
              cx="11"
              cy="11"
              r={radius}
              className="stroke-[#fa233b] fill-none transition-all duration-300"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
        </div>
        {showPercentage && (
          <span className="text-[10px] whitespace-nowrap">
            {isVerifying ? 'Verifying...' : `${progress}%`}
          </span>
        )}
      </div>
    );
  }

  if (status === 'QUEUED') {
    return (
      <div
        onClick={handleClick}
        title="Waiting in download queue"
        className={`inline-flex items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 transition-all flex-shrink-0 ${containerSizes[size]} ${className}`}
      >
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      </div>
    );
  }

  if (status === 'PAUSED') {
    return (
      <div
        onClick={handleClick}
        title="Download paused"
        className={`inline-flex items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 transition-all flex-shrink-0 ${containerSizes[size]} ${className}`}
      >
        <Pause className={`${iconSizes[size]}`} />
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <button
        onClick={handleClick}
        title={`Download failed: ${task?.error || 'Tap to retry'}`}
        className={`inline-flex items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all flex-shrink-0 cursor-pointer ${containerSizes[size]} ${className}`}
      >
        <AlertCircle className={`${iconSizes[size]}`} />
      </button>
    );
  }

  // NOT_DOWNLOADED: subtle Apple Music-style arrow down
  return (
    <button
      onClick={handleClick}
      title="Download to device"
      className={`inline-flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer ${containerSizes[size]} ${className}`}
    >
      <ArrowDown className={`${iconSizes[size]}`} />
    </button>
  );
}
