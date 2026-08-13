'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

export function CreatePlaylistModal() {
  const { createPlaylistModalOpen, setCreatePlaylistModalOpen, setToastMessage, setActiveTab, setSelectedPlaylistId } = usePlayerStore();
  const { createPlaylist } = usePlaylistStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (createPlaylistModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when closed
      setName('');
      setDescription('');
      setIsCreating(false);
    }
  }, [createPlaylistModalOpen]);

  const handleCreate = React.useCallback(async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    
    // Default to private for now as per MVP spec
    const newPlaylist = await createPlaylist(name.trim(), description.trim(), 'private');
    
    setIsCreating(false);
    
    if (newPlaylist) {
      setCreatePlaylistModalOpen(false);
      setSelectedPlaylistId(newPlaylist.id);
      setActiveTab('playlist');
      setToastMessage('Playlist created successfully');
    } else {
      setToastMessage('Failed to create playlist');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [name, description, createPlaylist, setCreatePlaylistModalOpen, setSelectedPlaylistId, setActiveTab, setToastMessage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!createPlaylistModalOpen) return;
      if (e.key === 'Escape') setCreatePlaylistModalOpen(false);
      if (e.key === 'Enter' && name.trim() && !isCreating) {
        e.preventDefault(); // Prevent accidental form submissions if wrapped in a form
        handleCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createPlaylistModalOpen, name, isCreating, handleCreate, setCreatePlaylistModalOpen]);

  if (!createPlaylistModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div 
        className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative"
      >
        <button 
          onClick={() => setCreatePlaylistModalOpen(false)}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-white tracking-tight mb-1">Create playlist</h2>
        <p className="text-sm text-slate-400 mb-6">Start a new collection of songs.</p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Playlist Name</label>
              <span className={`text-[10px] ${name.length >= 50 ? 'text-[#fa233b]' : 'text-slate-500'}`}>
                {name.length}/50
              </span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))} // Enforce limit
              placeholder="e.g. Telugu Melody"
              className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fa233b] transition-colors font-medium text-sm"
              disabled={isCreating}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Description <span className="text-slate-500 font-normal normal-case">(Optional)</span></label>
              <span className={`text-[10px] ${description.length >= 200 ? 'text-[#fa233b]' : 'text-slate-500'}`}>
                {description.length}/200
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="What's this playlist about?"
              rows={2}
              className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fa233b] transition-colors font-medium text-sm resize-none"
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button 
            onClick={() => setCreatePlaylistModalOpen(false)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white hover:bg-white/10 transition-colors"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-[#fa233b] hover:bg-[#d91e32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
