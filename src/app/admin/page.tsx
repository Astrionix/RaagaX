'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveListener {
  user_tag: string;
  user_name: string;
  song_title: string;
  artist: string;
  video_id: string;
  cover_url: string;
  album_name: string;
  duration_text: string;
  is_playing: boolean;
  updated_at: string;
}

interface ReleaseAsset {
  name: string;
  download_count: number;
}

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

interface DashboardData {
  liveListeners: LiveListener[];
  releases: Release[];
  workflowRuns: WorkflowRun[];
  repoViews: { count: number; uniques: number };
  repoClones: { count: number; uniques: number };
  fetchedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Admin password: set NEXT_PUBLIC_ADMIN_PASSWORD in your .env.local or Cloudflare env vars.
// Fallback is used only locally – never commit a real password here.
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'raagax_admin_2024';
const SUPABASE_URL   = 'https://qbqnlmfdmfayeztagvkj.supabase.co';
// Supabase anon key is intentionally public (row-level security enforced on backend).
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDAzNDksImV4cCI6MjEwMTc3NjM0OX0.Xjj4PQmu1LLYu7Yk0XiijVEDqzd4PqSsZzACaKkWLXk';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    if (conclusion === 'success') return '#22c55e';
    if (conclusion === 'failure') return '#ef4444';
    return '#f59e0b';
  }
  if (status === 'in_progress') return '#3b82f6';
  if (status === 'queued')      return '#a855f7';
  return '#6b7280';
}

function statusLabel(status: string, conclusion: string | null): string {
  if (status === 'in_progress') return '⚙️ Building…';
  if (status === 'queued')      return '⏳ Queued';
  if (status === 'completed') {
    if (conclusion === 'success') return '✅ Success';
    if (conclusion === 'failure') return '❌ Failed';
    if (conclusion === 'cancelled') return '🚫 Cancelled';
    return `✔ ${conclusion}`;
  }
  return status;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(false);
  const [shake, setShake]       = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('raagax_admin_auth', '1');
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: fadeIn 0.4s ease; }
        .shake { animation: shake 0.4s ease; }
        .input-field:focus { outline: none; border-color: #ef233c !important; box-shadow: 0 0 0 3px rgba(239,35,60,0.2) !important; }
        .login-btn:hover { background: #c51d31 !important; transform: translateY(-1px); }
        .login-btn:active { transform: translateY(0); }
      `}</style>

      <div className={`login-card ${shake ? 'shake' : ''}`} style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #ef233c, #b91c2f)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '28px',
            boxShadow: '0 8px 24px rgba(239,35,60,0.4)',
          }}>🎵</div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 }}>RaagaX Admin</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '6px' }}>Secure access only</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
              Admin Password
            </label>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter admin password"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.06)',
                border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>❌ Wrong password. Try again.</p>
            )}
          </div>

          <button
            type="submit"
            className="login-btn"
            style={{
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(135deg, #ef233c, #b91c2f)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Enter Dashboard →
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string; icon: string; accent: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent}33`,
      borderRadius: '16px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '80px', height: '80px',
        background: `radial-gradient(circle at center, ${accent}22, transparent 70%)`,
      }} />
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ color: accent, fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600', marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const supaHeaders = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      };

      // Fetch Supabase live listeners directly (anon key is public by design)
      // Fetch GitHub stats via our secure server-side API route (no token exposed to client)
      const [listenersRes, ghRes] = await Promise.allSettled([
        fetch(`${SUPABASE_URL}/rest/v1/user_activity?select=*&order=updated_at.desc`, { headers: supaHeaders }),
        fetch('/api/admin/stats'),
      ]);

      const liveListeners: LiveListener[] = listenersRes.status === 'fulfilled' && listenersRes.value.ok
        ? await listenersRes.value.json() : [];

      const ghData = ghRes.status === 'fulfilled' && ghRes.value.ok ? await ghRes.value.json() : {};
      const rawReleases = ghData.releases ?? [];
      const rawRuns     = ghData.workflowRuns ?? [];
      const viewsData   = ghData.views  ?? { count: 0, uniques: 0 };
      const clonesData  = ghData.clones ?? { count: 0, uniques: 0 };

      setData({
        liveListeners,
        releases: rawReleases,
        workflowRuns: rawRuns,
        repoViews: { count: viewsData.count ?? 0, uniques: viewsData.uniques ?? 0 },
        repoClones: { count: clonesData.count ?? 0, uniques: clonesData.uniques ?? 0 },
        fetchedAt: new Date().toISOString(),
      });
      setLastRefresh(new Date().toLocaleTimeString('en-IN', { hour12: true }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // auto-refresh every 1 minute
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totalDownloads = data?.releases.reduce((sum, r) =>
    sum + r.assets.reduce((a, asset) => a + asset.download_count, 0), 0) ?? 0;

  const activeToday = data?.liveListeners.filter(l => {
    const diff = Date.now() - new Date(l.updated_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length ?? 0;

  const currentlyPlaying = data?.liveListeners.filter(l => l.is_playing).length ?? 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#fff',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .live-dot { animation: pulse-dot 1.5s infinite; }
        .refresh-btn:hover { background: rgba(239,35,60,0.2) !important; }
        .logout-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .listener-card:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(239,35,60,0.3) !important; }
        .release-row:hover { background: rgba(255,255,255,0.05) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(20px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #ef233c, #b91c2f)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
          }}>🎵</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>RaagaX Admin</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Private Dashboard</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && (
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
              Last updated: {lastRefresh}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={fetchAll}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'rgba(239,35,60,0.1)',
              border: '1px solid rgba(239,35,60,0.3)',
              borderRadius: '8px',
              color: '#ef233c',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span style={loading ? { display: 'inline-block', animation: 'spin 1s linear infinite' } : {}}>↻</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="logout-btn"
            onClick={() => { sessionStorage.removeItem('raagax_admin_auth'); window.location.reload(); }}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
          <StatCard label="Live Listeners" value={data?.liveListeners.length ?? '—'} sub="In Supabase activity table" icon="🟢" accent="#22c55e" />
          <StatCard label="Active Today" value={activeToday} sub="Updated in last 24h" icon="⚡" accent="#f59e0b" />
          <StatCard label="Now Playing" value={currentlyPlaying} sub="is_playing = true" icon="▶️" accent="#3b82f6" />
          <StatCard label="Total Downloads" value={totalDownloads} sub="All GitHub releases" icon="📥" accent="#ef233c" />
          <StatCard label="Repo Views (14d)" value={`${data?.repoViews.uniques ?? '—'} unique`} sub={`${data?.repoViews.count ?? '—'} total views`} icon="👁️" accent="#a855f7" />
          <StatCard label="Repo Clones (14d)" value={`${data?.repoClones.uniques ?? '—'} unique`} sub={`${data?.repoClones.count ?? '—'} total clones`} icon="📦" accent="#06b6d4" />
        </div>

        {/* Live Listeners */}
        <div style={{ marginBottom: '40px' }}>
          <SectionHeader
            title="🟢 Live Listeners"
            sub={`${data?.liveListeners.length ?? 0} users synced with Supabase`}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {data?.liveListeners.map((listener) => (
              <div
                key={listener.user_tag}
                className="listener-card"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                {/* Cover art */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={listener.cover_url}
                    alt=""
                    style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', background: '#1a1a2e' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><rect width="52" height="52" fill="%23222"/><text y="30" x="10" font-size="20">🎵</text></svg>'; }}
                  />
                  {listener.is_playing && (
                    <div className="live-dot" style={{
                      position: 'absolute', bottom: '-2px', right: '-2px',
                      width: '12px', height: '12px',
                      background: '#22c55e',
                      borderRadius: '50%',
                      border: '2px solid #0a0a0f',
                    }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{
                      background: 'rgba(239,35,60,0.15)',
                      border: '1px solid rgba(239,35,60,0.3)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#ef233c',
                      letterSpacing: '0.5px',
                    }}>{listener.user_tag}</span>
                    {listener.is_playing && (
                      <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '600' }}>▶ LIVE</span>
                    )}
                  </div>
                  <div style={{
                    color: '#fff', fontSize: '13px', fontWeight: '600',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{listener.song_title}</div>
                  <div style={{
                    color: 'rgba(255,255,255,0.45)', fontSize: '12px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{listener.artist}</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '4px' }}>
                    {timeAgo(listener.updated_at)}
                    {listener.duration_text ? ` · ${listener.duration_text}` : ''}
                  </div>
                </div>
              </div>
            ))}
            {!loading && (!data?.liveListeners.length) && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '24px' }}>No active listeners right now.</div>
            )}
          </div>
        </div>

        {/* GitHub Actions */}
        <div style={{ marginBottom: '40px' }}>
          <SectionHeader title="⚙️ Recent CI/CD Builds" sub="Latest GitHub Actions workflow runs" />
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}>
            {data?.workflowRuns.map((run, i) => (
              <a
                key={run.id}
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                className="release-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 20px',
                  borderBottom: i < (data.workflowRuns.length - 1) ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '10px', height: '10px',
                  borderRadius: '50%',
                  background: statusColor(run.status, run.conclusion),
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${statusColor(run.status, run.conclusion)}`,
                }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{run.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    {run.event} → {run.head_branch}
                  </div>
                </div>
                <div style={{
                  color: statusColor(run.status, run.conclusion),
                  fontSize: '13px', fontWeight: '600',
                }}>{statusLabel(run.status, run.conclusion)}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', flexShrink: 0 }}>
                  {timeAgo(run.created_at)}
                </div>
              </a>
            ))}
            {!loading && !data?.workflowRuns.length && (
              <div style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No recent builds.</div>
            )}
          </div>
        </div>

        {/* Releases */}
        <div style={{ marginBottom: '40px' }}>
          <SectionHeader title="📦 GitHub Releases & Downloads" sub="APK download counts per release" />
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}>
            {data?.releases.map((release, i) => {
              const dlCount = release.assets.reduce((s, a) => s + a.download_count, 0);
              return (
                <a
                  key={release.tag_name}
                  href={release.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="release-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px 20px',
                    borderBottom: i < (data.releases.length - 1) ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    background: 'rgba(239,35,60,0.1)',
                    border: '1px solid rgba(239,35,60,0.25)',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#ef233c',
                    flexShrink: 0,
                  }}>{release.tag_name}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {release.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>
                      {new Date(release.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '16px' }}>📥</span>
                    <span style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>{dlCount}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>downloads</span>
                  </div>
                </a>
              );
            })}
            {!loading && !data?.releases.length && (
              <div style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No releases found.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px', paddingBottom: '40px' }}>
          RaagaX Admin Dashboard · Auto-refreshes every 60s · For authorized access only
        </div>
      </div>
    </div>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = sessionStorage.getItem('raagax_admin_auth');
    setAuthenticated(auth === '1');
  }, []);

  if (authenticated === null) return null; // hydration guard

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return <Dashboard />;
}
