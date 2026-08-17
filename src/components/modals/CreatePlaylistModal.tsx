'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2, Users, Globe, Lock } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

export function CreatePlaylistModal() {
  const { createPlaylistModalOpen, setCreatePlaylistModalOpen, setToastMessage, setActiveTab, setSelectedPlaylistId } = usePlayerStore();
  const { createPlaylist } = usePlaylistStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (createPlaylistModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setName('');
      setDescription('');
      setVisibility('public');
      setIsCollaborative(false);
      setIsCreating(false);
    }
  }, [createPlaylistModalOpen]);

  const handleCreate = React.useCallback(async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    
    const newPlaylist = await createPlaylist(name.trim(), description.trim(), visibility, isCollaborative);
    
    setIsCreating(false);
    
    if (newPlaylist) {
      setCreatePlaylistModalOpen(false);
      setSelectedPlaylistId(newPlaylist.id);
      setActiveTab('playlist');
      setToastMessage(isCollaborative ? 'Collaborative playlist created! You can now invite friends.' : 'Playlist created successfully');
    } else {
      setToastMessage('Failed to create playlist');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [name, description, visibility, isCollaborative, createPlaylist, setCreatePlaylistModalOpen, setSelectedPlaylistId, setActiveTab, setToastMessage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!createPlaylistModalOpen) return;
      if (e.key === 'Escape') setCreatePlaylistModalOpen(false);
      if (e.key === 'Enter' && name.trim() && !isCreating) {
        e.preventDefault();
        handleCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createPlaylistModalOpen, name, isCreating, handleCreate, setCreatePlaylistModalOpen]);

  if (!createPlaylistModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#12131a] border border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 relative"
      >
        <button 
          onClick={() => setCreatePlaylistModalOpen(false)}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-white tracking-tight mb-1">Create Playlist</h2>
        <p className="text-xs text-slate-400 mb-5">Start a new collection or invite friends to build it together.</p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Playlist Name</label>
              <span className={`text-[10px] font-mono ${name.length >= 50 ? 'text-[#fa233b]' : 'text-slate-500'}`}>
                {name.length}/50
              </span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="e.g. College Vibes, Late Night Telugu"
              className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fa233b] transition-colors font-medium text-xs sm:text-sm"
              disabled={isCreating}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Description <span className="text-slate-500 font-normal normal-case">(Optional)</span></label>
              <span className={`text-[10px] font-mono ${description.length >= 200 ? 'text-[#fa233b]' : 'text-slate-500'}`}>
                {description.length}/200
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="What's this playlist about?"
              rows={2}
              className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fa233b] transition-colors font-medium text-xs sm:text-sm resize-none"
              disabled={isCreating}
            />
          </div>

          {/* Collaborative Toggle */}
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Collaborative Playlist</h4>
                <p className="text-[10px] text-slate-400">Invite friends to add & reorder songs</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isCollaborative}
              onChange={(e) => setIsCollaborative(e.target.checked)}
              className="w-4 h-4 rounded accent-[#FA233B] cursor-pointer"
            />
          </div>

          {/* Visibility Selector */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                visibility === 'public'
                  ? 'bg-white/15 border-white/30 text-white shadow'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-bold">Public</div>
                <div className="text-[10px] text-slate-400">Anyone can listen</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                visibility === 'private'
                  ? 'bg-white/15 border-white/30 text-white shadow'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-xs font-bold">Private</div>
                <div className="text-[10px] text-slate-400">Only you & editors</div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
          <button 
            onClick={() => setCreatePlaylistModalOpen(false)}
            className="px-4 py-2 rounded-xl font-bold text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-[#fa233b] hover:bg-[#d91e32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/25"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Create Playlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
