import { useQuery } from '@tanstack/react-query';
import { lyricsGet } from '@/lyrics/http';
import { normalized } from '@/data/apple/artistPage';

export interface ArtistSignature {
  imageUrl: string;
  aspect: number;
  format: string;
}

export const PRIMARY_SIGNATURE_API_URL = 'https://proud-cascade-1654.de.deplexo.com';
export const SECONDARY_SIGNATURE_API_URL = 'https://yellow-king-f562.chandu3319r.workers.dev';

export const BUILTIN_SIGNATURE_ENDPOINTS = [
  PRIMARY_SIGNATURE_API_URL,
  SECONDARY_SIGNATURE_API_URL,
];

interface RawSignature {
  asset?: {
    url?: string;
    format?: string;
    width?: number;
    height?: number;
  };
  license?: {
    status?: string;
  };
  verification?: string;
  url?: string;
  original_url?: string;
  originalUrl?: string;
  format?: string;
  width?: number;
  height?: number;
}

function extractUrl(sig: RawSignature): string | null {
  if (sig.asset?.url?.startsWith('http')) return sig.asset.url;
  if (typeof sig.asset === 'string' && (sig.asset as string).startsWith('http')) return sig.asset as string;
  if (sig.url?.startsWith('http')) return sig.url;
  if (sig.original_url?.startsWith('http')) return sig.original_url;
  if (sig.originalUrl?.startsWith('http')) return sig.originalUrl;
  return null;
}

function extractFormat(sig: RawSignature, url: string): string {
  if (sig.asset?.format) return sig.asset.format.toLowerCase();
  if (sig.format) return sig.format.toLowerCase();
  const ext = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  return ext || '';
}

function extractAspect(sig: RawSignature): number {
  const w = sig.width || sig.asset?.width;
  const h = sig.height || sig.asset?.height;
  if (w && h && h > 0) return w / h;
  return 2.5;
}

function rank(sig: RawSignature, url: string): number {
  const status = sig.license?.status?.toLowerCase() || '';
  const license = status === 'known' ? 2 : status === 'requires_review' ? 1 : 0;
  const fmt = extractFormat(sig, url);
  const formatScore = fmt === 'svg' ? 2 : fmt === 'png' ? 1 : 0;
  const verification = sig.verification?.toLowerCase() || '';
  const verificationScore =
    verification === 'artist_verified' ? 3 : verification === 'verified' ? 2 : verification === 'unverified' ? 1 : 0;
  const panoramic = extractAspect(sig) >= 1.4 ? 1 : 0;
  return license * 1000 + formatScore * 100 + verificationScore * 10 + panoramic;
}

function parseSignatures(rawJson: string): ArtistSignature | null {
  try {
    const data = JSON.parse(rawJson);
    const signatures: RawSignature[] = Array.isArray(data?.signatures) ? data.signatures : [];
    if (!signatures.length) return null;

    let best: ArtistSignature | null = null;
    let bestScore = -Infinity;
    let bestArea = -1;

    for (const sig of signatures) {
      const url = extractUrl(sig);
      if (!url) continue;
      const lower = url.toLowerCase();
      if (lower.includes('logo') && !lower.includes('sig') && !lower.includes('autograph')) {
        continue;
      }
      const score = rank(sig, url);
      const w = sig.width || sig.asset?.width || 0;
      const h = sig.height || sig.asset?.height || 0;
      const area = w * h;

      if (!best || score > bestScore || (score === bestScore && area > bestArea)) {
        bestScore = score;
        bestArea = area;
        best = {
          imageUrl: url,
          aspect: extractAspect(sig),
          format: extractFormat(sig, url),
        };
      }
    }
    return best;
  } catch {
    return null;
  }
}

export async function fetchArtistSignature(artistName: string): Promise<ArtistSignature | null> {
  const cleanName = artistName.trim();
  if (!cleanName) return null;
  const encoded = encodeURIComponent(cleanName);

  for (const endpoint of BUILTIN_SIGNATURE_ENDPOINTS) {
    const cleanBase = endpoint.replace(/\/+$/, '');
    const url = cleanBase.includes('deplexo.com')
      ? `${cleanBase}/v1/signatures?artist=${encoded}`
      : `${cleanBase}/v1/artist/${encoded}/signatures`;

    try {
      const text = await lyricsGet(url, { route: 'direct' });
      if (text) {
        const parsed = parseSignatures(text);
        if (parsed) return parsed;
      }
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export function useArtistSignature(name: string | null | undefined): ArtistSignature | null {
  const key = normalized(name ?? '');
  const query = useQuery({
    queryKey: ['artist-signature', key],
    queryFn: () => fetchArtistSignature(name!),
    enabled: !!name && !!key,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
  });
  return query.data ?? null;
}

