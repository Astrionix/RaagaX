'use client';

import React, { useState } from 'react';
import { X, Download, Upload, Check, ShieldCheck, FileJson } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function BackupRestoreModal() {
  const { isBackupOpen, toggleBackupModal, exportBackupJson, importBackupJson } = usePlayerStore();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isBackupOpen) return null;

  const handleExport = () => {
    const jsonStr = exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RaagaX_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importBackupJson(content);
      if (success) {
        setImportStatus('Backup restored successfully!');
        setTimeout(() => {
          setImportStatus(null);
          toggleBackupModal();
        }, 1200);
      } else {
        setImportStatus('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl surface-card p-6 border border-white/10 shadow-2xl space-y-5 text-white relative select-none">
        <button
          onClick={toggleBackupModal}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#EF233C]/20 border border-red-800/40 text-[10px] font-bold text-[#EF233C] uppercase">
            <ShieldCheck className="w-3.5 h-3.5" /> BlackHole Data Engine
          </div>
          <h2 className="text-xl font-black tracking-tight">Backup & Restore Library</h2>
          <p className="text-xs text-slate-400">
            Export your liked songs, FLAC downloads, and audio settings to a JSON file or restore from a previous backup.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Export Box */}
          <div
            onClick={handleExport}
            className="p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer space-y-3 text-center group transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EF233C] flex items-center justify-center mx-auto shadow-md group-hover:scale-105 transition-transform">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Export Backup</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Save library as .json file</p>
            </div>
          </div>

          {/* Import Box */}
          <label className="p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer space-y-3 text-center group transition-all block relative">
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto shadow-md group-hover:scale-105 transition-transform border border-white/20">
              <Upload className="w-6 h-6 text-slate-200" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Restore Backup</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Load library from .json file</p>
            </div>
          </label>
        </div>

        {importStatus && (
          <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs font-semibold text-center text-emerald-400">
            {importStatus}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={toggleBackupModal}
            className="px-5 py-2.5 rounded-2xl bg-white/10 text-xs font-bold text-slate-300 hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
