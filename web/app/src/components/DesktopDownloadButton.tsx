import { ChevronDown, Download, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FaApple, FaLinux, FaWindows } from 'react-icons/fa6';
import { Menu, MenuHeader, MenuItem, MenuSeparator } from '@/components/Menu';
import { config } from '@/config';
import { detectDesktopOs, type DetectedDesktop, type DesktopOs } from '@/lib/platform';

function OsIcon({ os, size = 14 }: { os: DesktopOs; size?: number }) {
  switch (os) {
    case 'mac':
      return <FaApple size={size} className="text-white/90" />;
    case 'linux':
      return <FaLinux size={size} className="text-yellow-400" />;
    case 'windows':
    default:
      return <FaWindows size={size} className="text-blue-400" />;
  }
}

export function DesktopDownloadButton({ className = '' }: { className?: string }) {
  const [detected, setDetected] = useState<DetectedDesktop>(() => detectDesktopOs());
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setDetected(detectDesktopOs());
  }, []);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const downloadFile = (url: string) => {
    window.location.href = url;
    closeMenu();
  };

  return (
    <div className={`relative inline-flex items-center rounded-pill bg-quinary border border-white/[0.08] shadow-sm hover:bg-quaternary transition-all ${className}`}>
      {/* Primary direct download for auto-detected OS */}
      <a
        href={detected.url}
        download={detected.fileName}
        className="group inline-flex items-center gap-2 px-3.5 py-1.5 text-primary hover:text-white transition-colors select-none active:scale-98"
        title={`Download Raaga for ${detected.name} (${detected.fileName})`}
        aria-label={`Download Raaga Desktop for ${detected.name}`}
      >
        <span className="grid size-5 place-items-center rounded-full bg-white/[0.08]">
          <OsIcon os={detected.os} size={13} />
        </span>
        <span className="type-subhead-emphasized tracking-tight hidden sm:inline">
          Download for {detected.name}
        </span>
        <span className="type-subhead-emphasized tracking-tight sm:hidden">
          Download
        </span>
        <Download size={14} className="text-secondary group-hover:text-primary transition-transform group-hover:translate-y-0.5" />
      </a>

      {/* Dropdown trigger for selecting other OS versions */}
      <div className="h-4 w-px bg-white/10" aria-hidden="true" />
      <button
        type="button"
        className="grid size-7 place-items-center rounded-e-pill text-secondary hover:text-primary hover:bg-white/[0.06] transition-colors cursor-pointer"
        aria-label="Other desktop platforms"
        aria-haspopup="menu"
        aria-expanded={menuAnchor !== null}
        onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
      >
        <ChevronDown size={13} strokeWidth={2.5} />
      </button>

      {/* Contextual dropdown menu */}
      {menuAnchor && (
        <Menu anchor={menuAnchor} placement="below-end" onClose={closeMenu} label="Desktop Downloads">
          <MenuHeader>Desktop Downloads ({config.desktopDownloads.version})</MenuHeader>
          <MenuItem
            icon={<FaWindows size={14} className="text-blue-400" />}
            checked={detected.os === 'windows'}
            trailing={<span className="text-[11px] opacity-60">.exe</span>}
            onSelect={() => downloadFile(config.desktopDownloads.windowsSetup)}
          >
            Windows (Setup)
          </MenuItem>
          <MenuItem
            icon={<FaApple size={14} className="text-white/90" />}
            checked={detected.os === 'mac'}
            trailing={<span className="text-[11px] opacity-60">Apple Silicon</span>}
            onSelect={() => downloadFile(config.desktopDownloads.macArm64)}
          >
            macOS (ARM64)
          </MenuItem>
          <MenuItem
            icon={<FaApple size={14} className="text-white/90" />}
            trailing={<span className="text-[11px] opacity-60">Intel</span>}
            onSelect={() => downloadFile(config.desktopDownloads.macX64)}
          >
            macOS (x64)
          </MenuItem>
          <MenuItem
            icon={<FaLinux size={14} className="text-yellow-400" />}
            checked={detected.os === 'linux'}
            trailing={<span className="text-[11px] opacity-60">.AppImage</span>}
            onSelect={() => downloadFile(config.desktopDownloads.linuxAppImage)}
          >
            Linux (AppImage)
          </MenuItem>
          <MenuItem
            icon={<FaLinux size={14} className="text-yellow-400" />}
            trailing={<span className="text-[11px] opacity-60">.deb</span>}
            onSelect={() => downloadFile(config.desktopDownloads.linuxDeb)}
          >
            Linux (Debian / Ubuntu)
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<ExternalLink size={14} />}
            onSelect={() => {
              window.open(config.desktopDownloads.releasePage, '_blank', 'noreferrer');
              closeMenu();
            }}
          >
            All Releases &amp; Notes
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
