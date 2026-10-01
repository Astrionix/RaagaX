"use client";

import { useState } from "react";
import { X, Plus, ListMusic, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePlaylistModal({ isOpen, onClose }: CreatePlaylistModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createPlaylist } = useAuthStore();
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const pl = await createPlaylist(name.trim(), description.trim() || undefined);
      if (pl) {
        setName("");
        setDescription("");
        onClose();
        router.push(`/playlist/${pl.id}`);
      }
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-[24px] liquid-glass-sidebar border border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.85)] text-white select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Glare Reflection Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.08] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-raaga-red to-purple-600 flex items-center justify-center shadow-lg">
            <ListMusic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">Create New Playlist</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Organize your YouTube tracks and albums
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Playlist Name <span className="text-raaga-red">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Late Night Vibes, Telugu Hits, Gym Mix"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] border border-white/10 focus:border-white/25 text-xs text-white placeholder-neutral-500 focus:outline-none transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add an optional description for this collection..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] border border-white/10 focus:border-white/25 text-xs text-white placeholder-neutral-500 focus:outline-none transition resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-raaga-red hover:bg-raaga-redDark disabled:opacity-50 text-white text-xs font-bold shadow-[0_4px_16px_rgba(250,45,72,0.4)] transition hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Creating..." : "Create Playlist"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
