import { NextResponse } from 'next/server';
import { apiFetch } from '#common/helpers';

export const dynamic = 'force-dynamic';

function cleanQueryTerm(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s*\([^)]*soundtrack[^)]*\)/gi, '')
    .replace(/\s*\(from\s*[^)]+\)/gi, '')
    .replace(/\s*\(original[^)]*\)/gi, '')
    .replace(/\s*-\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english|bengali|marathi|gujarati|bhojpuri)/gi, '')
    .replace(/(\s*-\s*song|\s*-\s*album|\s*-\s*playlist)/gi, '')
    .trim();
}

const LANGUAGE_CURATED_TRENDS: Record<string, string[]> = {
  Telugu: [
    'Thandel',
    'Game Changer',
    'Devara Songs',
    'Pushpa 2',
    'Sid Sriram',
    'Anirudh Ravichander',
    'Kalki 2898 AD',
    'Telugu Love Songs',
  ],
  Hindi: [
    'Stree 2',
    'Arijit Singh',
    'Tauba Tauba',
    'Bhool Bhulaiyaa 3',
    'Singham Again',
    'Shreya Ghoshal',
    'Bollywood Love Hits',
    'Hindi 90s Hits',
  ],
  Tamil: [
    'GOAT',
    'Vettaiyan',
    'Anirudh Ravichander',
    'Amaran',
    'A.R. Rahman',
    'Tamil Melody Hits',
    'Yuvan Shankar Raja',
    'Leo Songs',
  ],
  Kannada: [
    'Sapta Sagaradaache Ello',
    'Bagheera',
    'Toxic',
    'Kantara',
    'Charan Raj',
    'Ravi Basrur',
    'Kannada Love Songs',
    'Sanjith Hegde',
  ],
  Malayalam: [
    'Aavesham',
    'Manjummel Boys',
    'ARM',
    'Sushin Shyam',
    'Premalu',
    'Malayalam Chill Melodies',
    'K.S. Harisankar',
    'Mollywood Viral Hits',
  ],
  Punjabi: [
    'Diljit Dosanjh',
    'Karan Aujla',
    'Shubh',
    'Sidhu Moose Wala',
    'AP Dhillon',
    'Punjabi Superhits Top 50',
    'Amrit Maan',
    'Punjabi Love Songs',
  ],
  English: [
    'Taylor Swift',
    'Sabrina Carpenter',
    'Billie Eilish',
    'The Weeknd',
    'Bruno Mars',
    'Coldplay',
    'Global Top 50',
    'Post Malone',
  ],
  Bengali: [
    'Arijit Singh Bengali',
    'Bohurupi',
    'Tekka',
    'Anupam Roy',
    'Shreya Ghoshal',
    'Bangla Superhits',
    'Rabindra Sangeet',
    'Bengali Love Songs',
  ],
  Marathi: [
    'Ajay-Atul',
    'Gharat Ganpati',
    'Nach Ga Ghuma',
    'Swapnil Bandodkar',
    'Marathi Superhits Top 50',
    'Aarya Ambekar',
    'Lavani Hits',
    'Marathi Love Songs',
  ],
  Gujarati: [
    'Aditya Gadhvi',
    'Kinjal Dave',
    'Geeta Rabari',
    'Garba Superhits',
    'Jignesh Kaviraj',
    'Gujarati Love Songs',
    'Navratri Nonstop',
    'Kirtidan Gadhvi',
  ],
  Bhojpuri: [
    'Pawan Singh',
    'Khesari Lal Yadav',
    'Shilpi Raj',
    'Neelkamal Singh',
    'Bhojpuri Superhits Top 50',
    'Arvind Akela Kallu',
    'Bhojpuri Dance Hits',
    'Pramod Premi Yadav',
  ],
};

const trendsCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'Telugu';
  const normalizedLang = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const cacheKey = normalizedLang.toLowerCase();

  const cached = trendsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      language: normalizedLang,
      data: cached.data,
    });
  }

  const fallback = (LANGUAGE_CURATED_TRENDS[normalizedLang] || LANGUAGE_CURATED_TRENDS['Telugu']).map((term, i) => ({
    rank: i + 1,
    term,
  }));

  try {
    const cookieLang = normalizedLang.toLowerCase() === 'all'
      ? 'english,hindi,telugu,tamil,kannada,malayalam,punjabi,marathi,gujarati,bengali,bhojpuri,haryanvi'
      : normalizedLang.toLowerCase();

    const { data, ok } = await apiFetch<any>({
      endpoint: 'content.getTrending' as any,
      params: {},
      cookieLanguage: cookieLang,
    });

    const rawList = Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data).filter((x: any) => x && (x.title || x.name)) : []);

    const extractedTerms: string[] = [];
    const seen = new Set<string>();

    for (const item of rawList) {
      const rawTitle = item.title || item.name;
      const clean = cleanQueryTerm(rawTitle);
      if (clean && clean.length >= 3 && clean.length <= 40) {
        const lower = clean.toLowerCase();
        if (!seen.has(lower) && !lower.includes('now trending') && !lower.includes('superhits top 50')) {
          seen.add(lower);
          extractedTerms.push(clean);
        }
      }
      if (extractedTerms.length >= 6) break;
    }

    // Blend live trending items with top artist/curated anchors
    const curatedAnchors = LANGUAGE_CURATED_TRENDS[normalizedLang] || LANGUAGE_CURATED_TRENDS['Telugu'];
    const mergedTerms: string[] = [];
    
    // Add live trends first
    for (const t of extractedTerms) {
      if (!mergedTerms.some(m => m.toLowerCase() === t.toLowerCase())) {
        mergedTerms.push(t);
      }
      if (mergedTerms.length >= 4) break;
    }

    // Fill remaining with curated anchors
    for (const c of curatedAnchors) {
      if (!mergedTerms.some(m => m.toLowerCase() === c.toLowerCase())) {
        mergedTerms.push(c);
      }
      if (mergedTerms.length >= 6) break;
    }

    const result = mergedTerms.map((term, i) => ({
      rank: i + 1,
      term,
    }));

    if (result.length > 0) {
      trendsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return NextResponse.json({
      success: true,
      source: 'live',
      language: normalizedLang,
      data: result.length > 0 ? result : fallback,
    });
  } catch (e) {
    return NextResponse.json({
      success: true,
      source: 'fallback',
      language: normalizedLang,
      data: fallback,
    });
  }
}
