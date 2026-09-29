'use client';

export interface TranslationResponse {
  status: 'success' | 'error';
  translatedLines: string[];
  sourceLanguage?: string;
  fromCache?: boolean;
  message?: string;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'zh', name: 'Chinese', native: '中文' },
];

export class LyricsTranslationClient {
  private static instance: LyricsTranslationClient;
  private memoryCache = new Map<string, TranslationResponse>();

  public static getInstance(): LyricsTranslationClient {
    if (!LyricsTranslationClient.instance) {
      LyricsTranslationClient.instance = new LyricsTranslationClient();
    }
    return LyricsTranslationClient.instance;
  }

  public async translateLyrics(
    lines: string[],
    targetLang: string = 'en',
    sourceLang: string = 'auto'
  ): Promise<TranslationResponse> {
    const key = `${targetLang}:${sourceLang}:${lines.slice(0, 5).join('|')}:${lines.length}`;
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }

    try {
      const res = await fetch('/api/lyrics/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, targetLang, sourceLang }),
      });

      if (!res.ok) {
        throw new Error(`Translation API error: ${res.status}`);
      }

      const data: TranslationResponse = await res.json();
      if (data.status === 'success') {
        this.memoryCache.set(key, data);
      }
      return data;
    } catch (err: any) {
      return {
        status: 'error',
        translatedLines: lines,
        message: err.message || 'Translation failed',
      };
    }
  }
}
