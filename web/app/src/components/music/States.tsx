import { useState, type ReactNode } from 'react';
import { FaChrome, FaFirefoxBrowser } from 'react-icons/fa';
import { Check, Copy, Download, ExternalLink, Puzzle, Sparkles } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { config } from '@/config';
import { useExtension } from '@/extension/useExtension';
import { downloadUrl, usePublishedExtension } from '@/extension/useExtensionUpdate';

/** A page-sized message, centred: also the Spotify page's sign-in invitation. */
export const stateStyles = {
  state: 'mx-auto my-20 flex max-w-[420px] flex-col items-center gap-2 px-(--body-gutter) text-center',
  title: 'type-title-2-emphasized',
  detail: 'type-body-tall text-secondary',
  button: 'mt-3 inline-flex h-8 items-center rounded-pill bg-key-bg px-4 type-body-emphasized text-white',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20 active:scale-95"
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

interface StepItemProps {
  number: number;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

function StepItem({ number, title, description, action }: StepItemProps) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-white/5 bg-white/[0.03] p-3.5 transition-colors hover:bg-white/[0.05]">
      <div className="grid size-7 flex-none place-items-center rounded-full bg-key-bg text-xs font-bold text-white shadow-sm">
        {number}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="text-xs leading-relaxed text-secondary">{description}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** In place of a YouTube page when the extension isn't installed: full step-by-step instructions. */
export function NeedsExtension({ what = 'YouTube Music' }: { what?: string }) {
  const status = useExtension();
  const published = usePublishedExtension();
  const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
  const [browser, setBrowser] = useState<'chrome' | 'firefox'>(isFirefox ? 'firefox' : 'chrome');

  const chromeHref = published ? downloadUrl(published.files.chrome) : config.extensionChromeUrl;
  const firefoxHref = published ? downloadUrl(published.files.firefox) : config.extensionFirefoxUrl;
  const activeHref = browser === 'firefox' ? firefoxHref : chromeHref;
  const version = published?.version ? `v${published.version}` : 'latest';

  return (
    <div className="mx-auto my-8 w-full max-w-[680px] px-(--body-gutter)">
      {/* Extension status indicator if connected */}
      {status.state === 'present' ? (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
          <Sparkles size={18} className="animate-pulse" />
          <span className="text-sm font-medium">
            Extension detected (v{status.extension.info.version})! Loading your music…
          </span>
        </div>
      ) : null}

      {/* Main card */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-quinary/80 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent p-6 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-key-bg/15 text-key shadow-inner">
            <Puzzle size={24} />
          </div>
          <h2 className="type-title-2-emphasized text-white">
            Set up the Raaga Extension to browse {what}
          </h2>
          <p className="mx-auto mt-2 max-w-[500px] text-xs leading-relaxed text-secondary">
            The browser extension enables direct YouTube Music playback, ad-free streaming, and playlist access right from your own browser. Complete these quick steps to get started:
          </p>

          {/* Browser Selector Tabs */}
          <div className="mx-auto mt-5 inline-flex rounded-xl bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setBrowser('chrome')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                browser === 'chrome'
                  ? 'bg-key-bg text-white shadow'
                  : 'text-secondary hover:text-white'
              }`}
            >
              <FaChrome size={14} />
              <span>Chrome / Edge / Brave</span>
            </button>
            <button
              type="button"
              onClick={() => setBrowser('firefox')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                browser === 'firefox'
                  ? 'bg-key-bg text-white shadow'
                  : 'text-secondary hover:text-white'
              }`}
            >
              <FaFirefoxBrowser size={14} />
              <span>Firefox</span>
            </button>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="flex flex-col gap-3 p-6">
          {browser === 'chrome' ? (
            <>
              <StepItem
                number={1}
                title="Download & Extract Extension"
                description={
                  <span>
                    Download the extension zip file below and extract it into a folder on your computer (e.g. your Downloads or Documents folder).
                  </span>
                }
                action={
                  <a
                    href={activeHref}
                    download={`raaga-extension-chrome.zip`}
                    className="inline-flex items-center gap-2 rounded-lg bg-key-bg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
                  >
                    <Download size={14} />
                    <span>Download Extension for Chrome ({version})</span>
                  </a>
                }
              />

              <StepItem
                number={2}
                title="Open Extensions Management Page"
                description={
                  <div className="flex flex-col gap-2">
                    <span>
                      Open a new browser tab and navigate to the Extensions management page:
                    </span>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/50 px-3 py-1.5">
                      <code className="font-mono text-xs text-key">chrome://extensions</code>
                      <CopyButton text="chrome://extensions" />
                      <span className="text-[11px] text-tertiary">
                        (or <code className="font-mono text-secondary">edge://extensions</code> for Edge,{' '}
                        <code className="font-mono text-secondary">brave://extensions</code> for Brave)
                      </span>
                    </div>
                  </div>
                }
              />

              <StepItem
                number={3}
                title="Enable Developer Mode"
                description="In the top-right corner of the extensions page, switch on the Developer mode toggle."
              />

              <StepItem
                number={4}
                title="Click Load unpacked"
                description="Click the Load unpacked button in the top-left toolbar, then select the folder you extracted in Step 1."
              />

              <StepItem
                number={5}
                title="You're All Set!"
                description="Once loaded, return to this tab — Raaga will automatically detect the extension and unlock full YouTube Music playback immediately!"
              />
            </>
          ) : (
            <>
              <StepItem
                number={1}
                title="Download & Extract Extension"
                description="Download the Firefox extension zip package and extract its contents."
                action={
                  <a
                    href={activeHref}
                    download={`raaga-extension-firefox.zip`}
                    className="inline-flex items-center gap-2 rounded-lg bg-key-bg px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
                  >
                    <Download size={14} />
                    <span>Download Extension for Firefox ({version})</span>
                  </a>
                }
              />

              <StepItem
                number={2}
                title="Open Firefox Debugging"
                description={
                  <div className="flex flex-col gap-2">
                    <span>Open a new tab and paste this URL into your address bar:</span>
                    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/50 px-3 py-1.5">
                      <code className="font-mono text-xs text-key">about:debugging#/runtime/this-firefox</code>
                      <CopyButton text="about:debugging#/runtime/this-firefox" />
                    </div>
                  </div>
                }
              />

              <StepItem
                number={3}
                title="Click Load Temporary Add-on"
                description="Click Load Temporary Add-on… and select manifest.json inside the extracted extension folder."
              />

              <StepItem
                number={4}
                title="Ready to Listen!"
                description="Return to this page to start searching, browsing and streaming your favorite songs without interruptions."
              />
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/20 px-6 py-3.5 text-xs text-tertiary">
          <span>Addons and synchronized lyrics work without the extension.</span>
          <PrefetchLink
            to="/extension"
            className="inline-flex items-center gap-1 font-medium text-key hover:underline"
          >
            <span>Extension Details &amp; Permissions</span>
            <ExternalLink size={12} />
          </PrefetchLink>
        </div>
      </div>
    </div>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={stateStyles.state}>
      <p className={stateStyles.title}>Couldn’t load this page</p>
      <p className={stateStyles.detail}>{error instanceof Error ? error.message : String(error)}</p>
      <button className={stateStyles.button} onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className={stateStyles.state}>
      <p className={stateStyles.title}>{title}</p>
      {detail && <p className={stateStyles.detail}>{detail}</p>}
    </div>
  );
}

/** A later page of a long list failed: what's loaded stays, with a way to try again. */
export function LoadMoreError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-(--body-gutter) pt-6 pb-10 type-callout text-secondary">
      <span>Couldn’t load more.</span>
      <button className="type-callout-emphasized text-key" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}
