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
    <div className="fixed inset-0 z-(--z-modal) grid animate-fade place-items-center bg-scrim p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* Modal Dialog */}
      <div
        className="flex max-h-[min(720px,calc(100vh-48px))] w-[min(560px,calc(100vw-32px))] animate-zoom flex-col rounded-[14px] bg-page shadow-glass"
        role="dialog"
        aria-modal="true"
        aria-label="Third-Party Licenses"
      >
        <div className="flex items-center justify-between border-b border-quaternary px-5 py-4">
          <div>
            <h2 className="type-title-2-emphasized text-primary">Third-Party Licenses</h2>
            <p className="type-callout text-secondary">Raaga is free software, and so is everything it is built on.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-[30px] place-items-center rounded-full bg-quaternary text-secondary hover:text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6 [scrollbar-width:thin]">
          {LICENSES.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="type-subhead-emphasized uppercase text-secondary">{group.title}</h3>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <div key={entry.name} className="rounded-xl bg-quinary p-3.5 border border-quaternary/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold type-body text-primary">{entry.name}</span>
                      <span className="rounded-md bg-quaternary px-2 py-0.5 text-[10px] font-mono text-secondary">
                        {entry.license}
                      </span>
                    </div>
                    {entry.note && <p className="type-callout text-secondary mt-1">{entry.note}</p>}
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="type-caption text-key hover:underline mt-1.5 inline-block"
                    >
                      {entry.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-quaternary px-5 py-3 bg-quinary/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill bg-key text-white px-5 py-1.5 type-callout-emphasized hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
