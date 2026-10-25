import { X } from 'lucide-react';

interface LicenseEntry {
  name: string;
  license: string;
  url: string;
  note?: string;
}

interface LicenseGroup {
  title: string;
  entries: LicenseEntry[];
}

const LICENSES: LicenseGroup[] = [
  {
    title: 'Core Audio & Media Engine',
    entries: [
      { name: 'Shaka Player', license: 'Apache-2.0', url: 'https://github.com/shaka-project/shaka-player', note: 'DASH & WebM audio streaming engine' },
      { name: 'HLS.js', license: 'Apache-2.0', url: 'https://github.com/video-dev/hls.js', note: 'Apple HLS audio stream demuxer' },
      { name: 'YouTubei.js', license: 'MIT', url: 'https://github.com/LuanRT/YouTube.js', note: 'YouTube Music API wrapper and extractor' },
      { name: 'bgutils-js', license: 'MIT', url: 'https://github.com/LuanRT/bgutils-js', note: 'BotGuard client challenge token solver' },
    ],
  },
  {
    title: 'UI & State Framework',
    entries: [
      { name: 'React 19', license: 'MIT', url: 'https://react.dev', note: 'Component UI runtime' },
      { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand', note: 'Fast, unopinionated reactive state store' },
      { name: 'TailwindCSS 4', license: 'MIT', url: 'https://tailwindcss.com', note: 'Utility-first CSS and styling engine' },
      { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev', note: 'Clean iconography' },
      { name: 'React Icons', license: 'MIT', url: 'https://react-icons.github.io/react-icons', note: 'Popular vector icons bundle' },
    ],
  },
  {
    title: 'Lyrics & Sync Protocol',
    entries: [
      { name: '@uimaxbai/am-lyrics', license: 'MIT', url: 'https://github.com/uimaxbai/am-lyrics', note: 'Apple Music syllable-timed lyrics renderer' },
      { name: 'LRCLIB', license: 'Community', url: 'https://lrclib.net', note: 'Open-source crowd-sourced synced lyrics' },
    ],
  },
];

export function LicensesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[calc(var(--z-web-chrome)+20)] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[85vh] w-[min(560px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-900/95 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Third-Party Licenses</h2>
            <p className="text-xs text-neutral-400">Raaga is free software, and so is everything it is built on.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6 [scrollbar-width:thin]">
          {LICENSES.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{group.title}</h3>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <div key={entry.name} className="rounded-xl bg-white/[0.03] p-3 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{entry.name}</span>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                        {entry.license}
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-neutral-400 mt-1">{entry.note}</p>}
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-red-400/80 hover:text-red-300 hover:underline mt-1 inline-block"
                    >
                      {entry.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-white/10 px-5 py-3 bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/15 hover:bg-white/20 px-5 py-2 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
