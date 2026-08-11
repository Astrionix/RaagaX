'use client';

import React, { useEffect, useState } from 'react';
import { StorageManager, StorageStatus } from '@/lib/offline/StorageManager';
import { useDownloadStore } from '@/context/useDownloadStore';


export default function DownloadsPage() {
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  
  const { 
    isOfflineStorageEnabled, 
    setOfflineStorageEnabled,
    wifiOnly,
    setWifiOnly,
    offlineSettings,
    setOfflineSettings
  } = useDownloadStore();

  useEffect(() => {
    StorageManager.getInstance().getStorageStatus().then(setStorageStatus);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-8">Offline Downloads</h1>
      
      {/* Enable Downloads Section */}
      <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-lg mb-4">
        <div>
          <h2 className="text-xl font-semibold">Downloads enabled</h2>
          <p className="text-sm text-zinc-400">Allow RaagaX to save music for offline playback.</p>
        </div>
        <button 
          onClick={() => setOfflineStorageEnabled(!isOfflineStorageEnabled)}
          className={`px-6 py-2 rounded-full font-semibold transition-colors ${isOfflineStorageEnabled ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
        >
          {isOfflineStorageEnabled ? '✓ Enabled' : 'Disabled'}
        </button>
      </div>

      <div className="bg-zinc-900 rounded-lg overflow-hidden mb-8">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <span className="font-medium text-lg">Wi-Fi only</span>
          <button 
            onClick={() => setWifiOnly(!wifiOnly)}
            className={`w-12 h-6 rounded-full relative transition-colors ${wifiOnly ? 'bg-green-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${wifiOnly ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <span className="font-medium text-lg">Download quality</span>
          <select 
            value={offlineSettings.audioQuality} 
            onChange={(e) => setOfflineSettings({ audioQuality: e.target.value as 'High' | 'Standard' })}
            className="bg-zinc-800 text-white px-3 py-1 rounded"
          >
            <option value="Standard">Standard</option>
            <option value="High">High</option>
          </select>
        </div>
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 opacity-50">
          <span className="font-medium text-lg">Video downloads</span>
          <span className="text-zinc-400">OFF (Not supported)</span>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <span className="font-medium text-lg">Storage limit</span>
          <select 
            onChange={(e) => StorageManager.getInstance().setDownloadLimit(parseInt(e.target.value))}
            className="bg-zinc-800 text-white px-3 py-1 rounded"
            defaultValue={5 * 1024 * 1024 * 1024}
          >
            <option value={1024 * 1024 * 1024}>1 GB</option>
            <option value={2 * 1024 * 1024 * 1024}>2 GB</option>
            <option value={5 * 1024 * 1024 * 1024}>5 GB</option>
            <option value={10 * 1024 * 1024 * 1024}>10 GB</option>
          </select>
        </div>

        {storageStatus && (
          <div className="p-4 bg-zinc-900">
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-2 flex">
              <div 
                className="bg-green-500 h-full" 
                style={{ width: `${(storageStatus.usage / storageStatus.quota) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-300">Used: {formatBytes(storageStatus.usage)}</span>
              <span className="text-zinc-300">Available: {formatBytes(storageStatus.available)}</span>
            </div>
          </div>
        )}
      </div>

      <button className="w-full bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-lg py-3 font-semibold">
        Manage Downloads
      </button>
    </div>
  );
}
