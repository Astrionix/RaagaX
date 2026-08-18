import React from 'react';
import { X, Music, HardDrive, FileAudio, Disc, Clock, Calendar, CheckCircle2, Share2, Play } from 'lucide-react';
import { Song } from '@/types/music';
import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';

interface SongDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
}

export function SongDetailsModal({ isOpen, onClose, song }: SongDetailsModalProps) {
  const { nativeDownloadedTracks, shareSongFile } = useDownloadStore();
  const { playSong } = usePlayerStore();

  if (!isOpen || !song) return null;

  const nativeTrack = nativeDownloadedTracks[song.id];
  const quality = nativeTrack?.quality || (song as any).quality || '320 kbps';
  const fileSize = nativeTrack?.fileSize ? (nativeTrack.fileSize / (1024 * 1024)).toFixed(1) + ' MB' : '~9.5 MB';
  const localPath = nativeTrack?.localPath || `Music/RaagaX/${song.title} - ${song.artist}.mp3`;
  const fileName = nativeTrack?.fileName || `${song.title} - ${song.artist}.mp3`;
  const completedDate = nativeTrack?.completedAt ? new Date(nativeTrack.completedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Saved Recently';

  const formatDuration = (sec?: number) => {
    if (!sec) return '3:30';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#14151a] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide">Song Details & Storage</h2>
              <p className="text-[11px] text-slate-400">Local MP3 audio file information</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Song Preview Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3.5">
            <img 
              src={song.coverUrl || '/app-icon.png'} 
              alt={song.title} 
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className="w-14 h-14 rounded-xl object-cover shadow-md flex-shrink-0 bg-slate-800"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white text-sm truncate">{song.title}</h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                  {quality} MP3
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> ID3v2 Tagged
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Format</span>
              <span className="font-bold text-white block">MP3 Audio (.mp3)</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Audio Bitrate</span>
              <span className="font-bold text-emerald-400 block">{quality} CBR</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">File Size</span>
              <span className="font-bold text-white block">{fileSize}</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Duration</span>
              <span className="font-bold text-white block">{formatDuration(song.duration)}</span>
            </div>
          </div>

          {/* Location & Path */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <HardDrive className="w-4 h-4 text-[#fa233b]" />
              <span>Storage Location</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 bg-black/40 p-2.5 rounded-xl border border-white/5 break-all leading-relaxed">
              {localPath}
            </p>
            <p className="text-[10px] text-slate-500">
              Visible in Android File Manager, Samsung Files, and third-party media players.
            </p>
          </div>

          {/* Album & Date Info */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 flex items-center gap-2"><Disc className="w-3.5 h-3.5 text-purple-400" /> Album</span>
              <span className="font-bold text-white truncate max-w-[200px]">{song.album || 'RaagaX Single'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-sky-400" /> Downloaded</span>
              <span className="font-bold text-slate-300">{completedDate}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 flex items-center gap-2.5 bg-black/20">
          <button
            onClick={() => {
              playSong(song);
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-[#fa233b] hover:bg-[#ff3b53] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" /> Play Offline
          </button>

          <button
            onClick={async () => {
              await shareSongFile(song.id);
            }}
            className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            title="Share MP3 File"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
