'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Loader2, Globe, Lock, Check, Image as ImageIcon, Music } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

export function CreatePlaylistModal() {
  const { createPlaylistModalOpen, setCreatePlaylistModalOpen, setToastMessage, setActiveTab, setSelectedPlaylistId } = usePlayerStore();
  const { createPlaylist } = usePlaylistStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [coverUrl, setCoverUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and reset state when modal opens/closes
  useEffect(() => {
    if (createPlaylistModalOpen) {
      setName('');
      setDescription('');
      setVisibility('private');
      setCoverUrl('');
      setIsCreating(false);
      setValidationError(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [createPlaylistModalOpen]);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= 50;

  const handleCreate = useCallback(async () => {
    if (!trimmedName) {
      setValidationError('Please enter a playlist name');
      inputRef.current?.focus();
      return;
    }

    if (isCreating) return;
    
    setIsCreating(true);
    setValidationError(null);
    
    try {
      const newPlaylist = await createPlaylist(trimmedName, description.trim(), visibility, coverUrl.trim());
      
      if (newPlaylist) {
        setCreatePlaylistModalOpen(false);
        setSelectedPlaylistId(newPlaylist.id);
        setActiveTab('playlist');
        setToastMessage(`Playlist "${newPlaylist.title}" created successfully`);
      } else {
        setValidationError('Failed to create playlist. Please try again.');
        setToastMessage('Failed to create playlist');
      }
    } catch (e: any) {
      setValidationError(e?.message || 'Error creating playlist');
    } finally {
      setIsCreating(false);
    }
  }, [trimmedName, description, visibility, coverUrl, isCreating, createPlaylist, setCreatePlaylistModalOpen, setSelectedPlaylistId, setActiveTab, setToastMessage]);

  // Keyboard navigation (Enter to submit, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!createPlaylistModalOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setCreatePlaylistModalOpen(false);
      }
      if (e.key === 'Enter' && isValid && !isCreating && document.activeElement !== document.querySelector('textarea')) {
        e.preventDefault();
        handleCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createPlaylistModalOpen, isValid, isCreating, handleCreate, setCreatePlaylistModalOpen]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !createPlaylistModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) setCreatePlaylistModalOpen(false);
      }}
    >
      <div 
        className="bg-[#12131A] border border-white/12 rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 relative overflow-hidden text-white select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#fa233b]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={() => setCreatePlaylistModalOpen(false)}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
          disabled={isCreating}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5 pr-8">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Create Playlist</h2>
          <p className="text-xs text-slate-400 mt-1">Build your personal music collection</p>
        </div>

        <div className="space-y-4">
          {/* 1. PLAYLIST NAME INPUT */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Playlist Name *</label>
              <span className={`text-[10px] font-mono font-medium ${name.length >= 50 ? 'text-[#fa233b]' : 'text-slate-500'}`}>
                {name.length}/50
              </span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              maxLength={50}
              onChange={(e) => {
                setName(e.target.value.slice(0, 50));
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Telugu Favorites, Workout Mix"
              className="w-full bg-[#08090E] border border-white/15 focus:border-[#fa233b] rounded-2xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none transition-all text-sm font-medium shadow-inner"
              disabled={isCreating}
            />
            {validationError && (
              <p className="text-xs text-rose-400 mt-1.5 font-medium animate-in fade-in duration-150">
                {validationError}
              </p>
            )}
          </div>

          {/* 2. DESCRIPTION INPUT (OPTIONAL) */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              maxLength={150}
              onChange={(e) => setDescription(e.target.value.slice(0, 150))}
              placeholder="Give your playlist a vibe or mood description..."
              rows={2}
              className="w-full bg-[#08090E] border border-white/15 focus:border-[#fa233b] rounded-2xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none transition-all text-xs font-medium shadow-inner resize-none"
              disabled={isCreating}
            />
          </div>

          {/* 3. VISIBILITY (Public vs Private Cards) */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">Visibility</label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Private Card (Default) */}
              <button
                type="button"
                onClick={() => setVisibility('private')}
                disabled={isCreating}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer relative ${
                  visibility === 'private'
                    ? 'bg-[#fa233b]/10 border-[#fa233b]/60 text-white shadow-md shadow-red-500/10'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Lock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${visibility === 'private' ? 'text-[#fa233b]' : 'text-amber-400'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">Private</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Only in your library</div>
                  </div>
                </div>
                {visibility === 'private' && (
                  <div className="w-4 h-4 rounded-full bg-[#fa233b] text-white flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Public Card */}
              <button
                type="button"
                onClick={() => setVisibility('public')}
                disabled={isCreating}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer relative ${
                  visibility === 'public'
                    ? 'bg-[#fa233b]/10 border-[#fa233b]/60 text-white shadow-md shadow-red-500/10'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Globe className={`w-4 h-4 mt-0.5 flex-shrink-0 ${visibility === 'public' ? 'text-[#fa233b]' : 'text-blue-400'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">Public</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Shareable with friends</div>
                  </div>
                </div>
                {visibility === 'public' && (
                  <div className="w-4 h-4 rounded-full bg-[#fa233b] text-white flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
          <button 
            type="button"
            onClick={() => setCreatePlaylistModalOpen(false)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleCreate}
            disabled={!isValid || isCreating}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-[#fa233b] hover:bg-[#d91e32] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/25 active:scale-95 cursor-pointer"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Create Playlist</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
