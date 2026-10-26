import { AlertCircle, CheckCircle2, Globe, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddonClient, maskUrl } from '@/data/addon/addonClient';
import { useAddonStore } from '@/data/addon/addonStore';
import type { AddonSourceConfig, AddonTier } from '@/data/addon/types';
import { Select } from '@/components/Select';
import { settingsUi } from './settingsStyles';

export function AddonSettings() {
  const addons = useAddonStore((s) => s.addons);
  const addAddon = useAddonStore((s) => s.addAddon);
  const removeAddon = useAddonStore((s) => s.removeAddon);
  const toggleAddon = useAddonStore((s) => s.toggleAddon);
  const setTier = useAddonStore((s) => s.setTier);

  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);

  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const checkAddonHealth = async (addon: AddonSourceConfig) => {
    setPingingId(addon.id);
    const start = performance.now();
    try {
      const client = new AddonClient(addon.baseUrl);
      const manifest = await client.manifest();
      const latency = Math.round(performance.now() - start);
      setPingResults((prev) => ({
        ...prev,
        [addon.id]: {
          ok: true,
          message: `Online (${latency}ms) · ${manifest.name || manifest.id} · Search & Stream ready`,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPingResults((prev) => ({
        ...prev,
        [addon.id]: {
          ok: false,
          message: msg.includes('404')
            ? 'Server Offline (HTTP 404). Container may be stopped or path invalid.'
            : msg,
        },
      }));
    } finally {
      setPingingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = inputUrl.trim();
    if (!url) return;

    setTesting(true);
    setStatus(null);

    try {
      const added = await addAddon(url, inputName.trim() || undefined);
      setStatus({ message: `Connected to "${added.name}" successfully!`, ok: true });
      setInputUrl('');
      setInputName('');
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : String(err), ok: false });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Add New Add-on Form */}
      <form onSubmit={handleAdd} className={`${settingsUi.group} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-secondary" />
          <span className="type-body-emphasized font-medium text-white">Add New Add-on Server</span>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Addon Server URL (e.g. https://my-addon.example.com)"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            disabled={testing}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Custom Label (optional)"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              disabled={testing}
              className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={testing || !inputUrl.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-40"
            >
              {testing ? (
                <>
                  <div className="size-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  <span>Testing…</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Connect</span>
                </>
              )}
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`flex items-center gap-2 rounded-xl p-2.5 text-xs ${
              status.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'
            }`}
          >
            {status.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}
      </form>

      {/* Configured Add-ons List */}
      <div className="space-y-2">
        <h4 className="text-xs font-mono uppercase tracking-wider text-secondary px-1">Configured Sources ({addons.length})</h4>

        {addons.length === 0 ? (
          <div className={`${settingsUi.group} p-6 text-center text-xs text-secondary`}>
            No custom Add-ons configured yet. Paste an Add-on URL above to get started.
          </div>
        ) : (
          addons.map((addon) => {
            const ping = pingResults[addon.id];
            const isPinging = pingingId === addon.id;

            return (
              <div
                key={addon.id}
                className={`${settingsUi.group} p-3.5 sm:p-4 flex flex-col gap-2.5`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="type-body-emphasized font-semibold text-white truncate">{addon.name}</span>
                      {addon.manifest?.version && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                          v{addon.manifest.version}
                        </span>
                      )}
                      {addon.enabled ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 truncate">
                      {maskUrl(addon.baseUrl)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Test Server Ping Button */}
                    <button
                      type="button"
                      onClick={() => checkAddonHealth(addon)}
                      disabled={isPinging}
                      className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Test server connection and latency"
                    >
                      <RefreshCw className={`size-3.5 ${isPinging ? 'animate-spin text-amber-400' : ''}`} />
                    </button>

                    {/* Preferred Quality Tier Selector */}
                    <Select<AddonTier>
                      label="Quality"
                      value={addon.tier}
                      options={[
                        { value: 'LOSSLESS', label: 'Lossless FLAC' },
                        { value: 'HIGH', label: 'High (320 kbps)' },
                        { value: 'LOW', label: 'Standard (128 kbps)' },
                      ]}
                      onChange={(tier) => setTier(addon.id, tier)}
                    />

                    {/* Native Apple-style Switch */}
                    <input
                      type="checkbox"
                      className={settingsUi.switch}
                      checked={addon.enabled}
                      onChange={() => toggleAddon(addon.id)}
                      aria-label={addon.enabled ? 'Disable addon' : 'Enable addon'}
                    />

                    {/* Delete Addon Button */}
                    <button
                      type="button"
                      onClick={() => removeAddon(addon.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove this Add-on"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Live Diagnostic Ping Result */}
                {ping && (
                  <div
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-mono ${
                      ping.ok
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/20'
                    }`}
                  >
                    {ping.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                    <span className="truncate">{ping.message}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
