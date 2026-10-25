import { useState } from 'react';
import {
  Check,
  Cpu,
  Globe,
  Layers,
  Music2,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAddons } from '@/data/addons/addonManager';
import { settingsUi } from './settingsStyles';

export default function AddonsPage() {
  const { addons, loading, error, addAddonByUrl, toggleAddon, removeAddon, checkAllStatuses } = useAddons();
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setAdding(true);
    setFeedback(null);
    try {
      const added = await addAddonByUrl(urlInput);
      setFeedback(`Added "${added.name}" successfully!`);
      setUrlInput('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to add addon.');
    } finally {
      setAdding(false);
    }
  };

  const handleQuickAdd = async (presetUrl: string) => {
    setUrlInput(presetUrl);
    setAdding(true);
    setFeedback(null);
    try {
      const added = await addAddonByUrl(presetUrl);
      setFeedback(`Added "${added.name}" successfully!`);
      setUrlInput('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to add addon.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={settingsUi.centered}>
      <PageHeader title="Audio Addons" />
      <div className={settingsUi.body}>
        {/* Hero Card */}
        <div className="mx-4 mb-6 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-red-500/10 to-transparent p-5 backdrop-blur-xl shadow-glass">
          <div className="flex items-center gap-2.5 text-indigo-400 mb-2">
            <Cpu size={22} className="animate-pulse" />
            <span className="type-title-3-emphasized text-primary">Custom Audio Streaming Sources</span>
          </div>
          <p className="type-body text-secondary leading-relaxed">
            Connect high-fidelity external audio sources, lossless streaming mirrors, or your own self-hosted Raaga
            Addon servers. Addons let Raaga query lossless FLAC, master bit-exact streams, and alternate catalogues.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Zap size={13} className="text-amber-400" /> Lossless FLAC
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Music2 size={13} className="text-emerald-400" /> Bit-Exact Audio
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Layers size={13} className="text-indigo-400" /> Multi-Source Priority
            </span>
          </div>
        </div>

        {/* Add New Addon Form */}
        <h2 className={settingsUi.sectionHeader}>Add New Addon Server</h2>
        <section className={settingsUi.group}>
          <form onSubmit={handleAdd} className="p-4 flex flex-col gap-3">
            <label htmlFor="addon-url" className="text-sm font-medium text-primary">
              Addon Server URL or manifest.json
            </label>
            <div className="flex gap-2 max-sm:flex-col">
              <input
                id="addon-url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-addon-server.com"
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-key transition-all"
                required
              />
              <button
                type="submit"
                disabled={adding || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-key px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                {adding ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add Addon
                  </>
                )}
              </button>
            </div>
            {feedback && (
              <p className={`text-xs ${feedback.includes('successfully') ? 'text-emerald-400' : 'text-red-400'}`}>
                {feedback}
              </p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
        </section>

        {/* Preset Community Sources */}
        <div className="mx-4 mt-3 mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Preset Addons:</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickAdd('https://lossless-v2.raaga.app')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-quinary px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-quaternary transition-colors cursor-pointer"
            >
              <Globe size={13} className="text-key" /> Lossless Hi-Fi Mirror
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd('https://tidal-stream.raaga.app')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-quinary px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-quaternary transition-colors cursor-pointer"
            >
              <Sparkles size={13} className="text-emerald-400" /> Tidal FLAC Master
            </button>
          </div>
        </div>

        {/* Configured Addons List */}
        <div className="flex items-center justify-between mx-4 mt-8 mb-2">
          <h2 className="type-subhead-emphasized uppercase text-secondary">
            Installed Addons ({addons.filter((a) => a.enabled).length}/{addons.length} active)
          </h2>
          <button
            type="button"
            onClick={() => checkAllStatuses()}
            className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
            title="Refresh statuses"
          >
            <RefreshCw size={13} /> Check Status
          </button>
        </div>

        <section className={settingsUi.group}>
          {addons.length === 0 ? (
            <div className="p-8 text-center text-secondary">
              <Server size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No audio addons configured yet.</p>
            </div>
          ) : (
            addons.map((addon) => (
              <div
                key={addon.id}
                className="relative flex items-center justify-between gap-4 p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`mt-1 grid size-8 flex-none place-items-center rounded-lg border ${
                      addon.enabled
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-secondary'
                    }`}
                  >
                    <Server size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-primary truncate">{addon.name}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-secondary">
                        v{addon.version}
                      </span>
                      {addon.isDefault && (
                        <span className="rounded-full bg-key/20 px-2 py-0.5 text-[10px] font-medium text-key">
                          Core
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          addon.status === 'online' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            addon.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        {addon.pingMs ? `${addon.pingMs}ms` : addon.status}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 truncate">{addon.baseUrl}</p>
                    {addon.description && (
                      <p className="text-xs text-tertiary mt-1 line-clamp-1">{addon.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-none">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addon.enabled}
                      onChange={() => toggleAddon(addon.id)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>

                  {!addon.isDefault && (
                    <button
                      type="button"
                      onClick={() => removeAddon(addon.id)}
                      className="p-1.5 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove addon"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
