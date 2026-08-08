import { Song } from '@/types/music';

/**
 * Downloads high quality 320kbps audio file directly to user's local device
 * Uses server-side proxy route /api/download to bypass CORS restrictions
 */
export async function downloadSongFile(song: Song): Promise<boolean> {
  if (!song || !song.audioUrl) return false;

  const sanitizeName = (str: string) => str.replace(/[/\\?%*:|"<>]/g, '').trim();
  const filename = `${sanitizeName(song.title)} - ${sanitizeName(song.artist)}.mp3`;

  const downloadProxyUrl = `/api/download?url=${encodeURIComponent(song.audioUrl)}&name=${encodeURIComponent(filename)}`;

  try {
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = downloadProxyUrl;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
    }, 1000);

    return true;
  } catch (err) {
    console.warn('Proxy download notice, opening direct link:', err);
    window.open(song.audioUrl, '_blank');
    return true;
  }
}
