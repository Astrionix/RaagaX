import { Download, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FaApple, FaLinux, FaWindows } from 'react-icons/fa6';
import { Menu, MenuHeader, MenuItem, MenuSeparator } from '@/components/Menu';
import { config } from '@/config';
import { detectDesktopOs, type DetectedDesktop } from '@/lib/platform';

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
    <>
      {/* Round medium-sized download button with auto-detected OS installer */}
      <a
        href={detected.url}
        download={detected.fileName}
        className={`group grid size-10 place-items-center rounded-full border-[0.75px] border-quaternary bg-quinary text-primary hover:bg-quaternary hover:text-primary shadow-sm transition-all duration-200 active:scale-95 touch-manipulation select-none cursor-pointer ${className}`}
        title={`Download Raaga for ${detected.name} (Right-click for other platforms)`}
        aria-label={`Download Raaga Desktop for ${detected.name}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuAnchor(e.currentTarget);
        }}
      >
        <Download size={18} strokeWidth={2.2} className="transition-transform duration-200 group-hover:translate-y-0.5" />
      </a>

      {/* Contextual dropdown menu for other platforms */}
      {menuAnchor && (
        <Menu anchor={menuAnchor} placement="below-end" onClose={closeMenu} label="Desktop Downloads">
          <MenuHeader>Download Desktop ({config.desktopDownloads.version})</MenuHeader>
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
    </>
  );
}
