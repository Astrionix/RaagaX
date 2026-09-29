import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// In-memory bounded LRU cache for translations (similar to Android's LruCache)
interface CacheEntry {
  translatedTexts: string[];
  sourceLanguage: string;
  timestamp: number;
}
const translationCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lines, targetLang = 'en', sourceLang = 'auto' } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Lines array is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Cache key
    const cacheKey = `${targetLang}:${sourceLang}:${lines.join('\n')}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          status: 'success',
          translatedLines: cached.translatedTexts,
          sourceLanguage: cached.sourceLanguage,
          fromCache: true,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Delimiter for preserving lines
    const DELIMITER = '\n___RAAGA_BREAK___\n';
    const joinedText = lines.map((l: string) => l.trim()).join(DELIMITER);

    // Call Google's lightweight translate API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joinedText)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`Translation endpoint error: ${response.status}`);
    }

    const data = await response.json();
    // Google translate returns: [ [ [ "trans", "orig", ... ], ... ], null, "detected_lang" ]
    const segments: any[] = data?.[0] || [];
    const detectedLang: string = data?.[2] || sourceLang;

    let fullTranslated = '';
    for (const seg of segments) {
      if (Array.isArray(seg) && typeof seg[0] === 'string') {
        fullTranslated += seg[0];
      }
    }

    // Split back by delimiter or newline
    let translatedLines = fullTranslated
      .split(/___RAAGA_BREAK___|\n___RAAGA_BREAK___\n/)
      .map((s) => s.trim());

    // If split length doesn't match original lines length exactly, fall back to line-by-line mapping
    if (translatedLines.length !== lines.length) {
      const lineSplit = fullTranslated.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lineSplit.length === lines.length) {
        translatedLines = lineSplit;
      } else {
        // Fallback: pad or truncate so lengths match
        while (translatedLines.length < lines.length) {
          translatedLines.push(lines[translatedLines.length]);
        }
        if (translatedLines.length > lines.length) {
          translatedLines = translatedLines.slice(0, lines.length);
        }
      }
    }

    // Keep cache bounded
    if (translationCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = translationCache.keys().next().value;
      if (oldestKey) translationCache.delete(oldestKey);
    }

    translationCache.set(cacheKey, {
      translatedTexts: translatedLines,
      sourceLanguage: detectedLang,
      timestamp: Date.now(),
    });

    return NextResponse.json(
      {
        status: 'success',
        translatedLines,
        sourceLanguage: detectedLang,
        fromCache: false,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Translation failed',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
