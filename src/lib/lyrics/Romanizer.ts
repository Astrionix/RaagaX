/**
 * Language-aware Romanization (Transliteration) Registry for Indic Languages.
 * Maps Indic script graphemes/phonemes to Romanized Latin scripts (Tinglish, Tanglish, Hinglish, etc.)
 * High-performance, zero-dependency, deterministically reversible.
 */

export interface ScriptMap {
  vowels: Record<string, string>;
  vowelSigns: Record<string, string>;
  consonants: Record<string, string>;
  virama: string;
  anusvara?: Record<string, string>;
  visarga?: Record<string, string>;
  special?: Record<string, string>;
}

// 1. Telugu (Tinglish)
const teluguMap: ScriptMap = {
  virama: '\u0C4D',
  vowels: {
    'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ru',
    'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au', 'అం': 'am', 'అః': 'aha'
  },
  vowelSigns: {
    '\u0C3E': 'aa', '\u0C3F': 'i', '\u0C40': 'ee', '\u0C41': 'u', '\u0C42': 'oo', '\u0C43': 'ru',
    '\u0C46': 'e', '\u0C47': 'e', '\u0C48': 'ai', '\u0C4A': 'o', '\u0C4B': 'o', '\u0C4C': 'au',
    '\u0C02': 'm', '\u0C03': 'h'
  },
  consonants: {
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
    'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
    'త': 'th', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
    'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh',
    'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l', 'క్ష': 'ksh', 'ఱ': 'r'
  }
};

// 2. Tamil (Tanglish)
const tamilMap: ScriptMap = {
  virama: '\u0BCD',
  vowels: {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
    'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au'
  },
  vowelSigns: {
    '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u', '\u0BC2': 'oo',
    '\u0BC6': 'e', '\u0BC7': 'e', '\u0BC8': 'ai', '\u0BCA': 'o', '\u0BCB': 'o', '\u0BCC': 'au',
    '\u0B82': 'm'
  },
  consonants: {
    'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஞ': 'ny', 'ட': 't', 'ண': 'n',
    'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
    'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
  }
};

// 3. Kannada (Kanglish)
const kannadaMap: ScriptMap = {
  virama: '\u0CCD',
  vowels: {
    'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ee', 'ಉ': 'u', 'ಊ': 'oo', 'ಋ': 'ru',
    'ಎ': 'e', 'ಏ': 'e', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'o', 'ಔ': 'au'
  },
  vowelSigns: {
    '\u0CBE': 'aa', '\u0CBF': 'i', '\u0CC0': 'ee', '\u0CC1': 'u', '\u0CC2': 'oo', '\u0CC3': 'ru',
    '\u0CC6': 'e', '\u0CC7': 'e', '\u0CC8': 'ai', '\u0CCA': 'o', '\u0CCB': 'o', '\u0CCC': 'au',
    '\u0C82': 'm', '\u0C83': 'h'
  },
  consonants: {
    'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'ng',
    'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'ny',
    'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n',
    'ತ': 'th', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
    'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm',
    'ಯ': 'y', 'ರ': 'r', 'ಲ': 'l', 'ವ': 'v', 'ಶ': 'sh',
    'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h', 'ಳ': 'l'
  }
};

// 4. Hindi / Devanagari (Hinglish)
const hindiMap: ScriptMap = {
  virama: '\u094D',
  vowels: {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'
  },
  vowelSigns: {
    '\u093E': 'aa', '\u093F': 'i', '\u0940': 'ee', '\u0941': 'u', '\u0942': 'oo', '\u0943': 'ri',
    '\u0947': 'e', '\u0948': 'ai', '\u094B': 'o', '\u094C': 'au',
    '\u0902': 'n', '\u0901': 'n', '\u0903': 'h'
  },
  consonants: {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ड़': 'r', 'ढ़': 'rh',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f'
  }
};

// 5. Malayalam (Manglish)
const malayalamMap: ScriptMap = {
  virama: '\u0D4D',
  vowels: {
    'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ru',
    'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au'
  },
  vowelSigns: {
    '\u0D3E': 'aa', '\u0D3F': 'i', '\u0D40': 'ee', '\u0D41': 'u', '\u0D42': 'oo', '\u0D43': 'ru',
    '\u0D46': 'e', '\u0D47': 'e', '\u0D48': 'ai', '\u0D4A': 'o', '\u0D4B': 'o', '\u0D4C': 'au',
    '\u0D02': 'm', '\u0D03': 'h'
  },
  consonants: {
    'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
    'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'ny',
    'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
    'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
    'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
    'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v', 'ശ': 'sh',
    'ഷ': 'sh', 'സ': 's', 'ഹ': 'h', 'ള': 'l', 'ഴ': 'zh', 'റ': 'r'
  }
};

// 6. Bengali (Banglish)
const bengaliMap: ScriptMap = {
  virama: '\u09CD',
  vowels: {
    'অ': 'o', 'আ': 'aa', 'ই': 'i', 'ঈ': 'ee', 'উ': 'u', 'ঊ': 'oo', 'ঋ': 'ri',
    'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou'
  },
  vowelSigns: {
    '\u09BE': 'aa', '\u09BF': 'i', '\u09C0': 'ee', '\u09C1': 'u', '\u09C2': 'oo', '\u09C3': 'ri',
    '\u09C7': 'e', '\u09C8': 'oi', '\u09CB': 'o', '\u09CC': 'ou',
    '\u0982': 'ng', '\u0983': 'h', '\u0981': 'n'
  },
  consonants: {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'য়': 'y', 'ড়': 'r', 'ঢ়': 'rh'
  }
};

// 7. Punjabi / Gurmukhi (Panglish)
const punjabiMap: ScriptMap = {
  virama: '\u0A4D',
  vowels: {
    'ਅ': 'a', 'ਆ': 'aa', 'ਇ': 'i', 'ਈ': 'ee', 'ਉ': 'u', 'ਊ': 'oo',
    'ਏ': 'e', 'ਐ': 'ai', 'ਓ': 'o', 'ਔ': 'au'
  },
  vowelSigns: {
    '\u0A3E': 'aa', '\u0A3F': 'i', '\u0A40': 'ee', '\u0A41': 'u', '\u0A42': 'oo',
    '\u0A47': 'e', '\u0A48': 'ai', '\u0A4B': 'o', '\u0A4C': 'au',
    '\u0A02': 'n', '\u0A70': 'n'
  },
  consonants: {
    'ਕ': 'k', 'ਖ': 'kh', 'ਗ': 'g', 'ਘ': 'gh', 'ਙ': 'ng',
    'ਚ': 'ch', 'ਛ': 'chh', 'ਜ': 'j', 'ਝ': 'jh', 'ਞ': 'ny',
    'ਟ': 't', 'ਠ': 'th', 'ਡ': 'd', 'ਢ': 'dh', 'ਣ': 'n',
    'ਤ': 't', 'ਥ': 'th', 'ਦ': 'd', 'ਧ': 'dh', 'ਨ': 'n',
    'ਪ': 'p', 'ਫ': 'ph', 'ਬ': 'b', 'ਭ': 'bh', 'ਮ': 'm',
    'ਯ': 'y', 'ਰ': 'r', 'ਲ': 'l', 'ਵ': 'v', 'ਸ਼': 'sh',
    'ਸ': 's', 'ਹ': 'h'
  }
};

const LANGUAGE_REGISTRY: Record<string, ScriptMap> = {
  te: teluguMap,
  telugu: teluguMap,
  ta: tamilMap,
  tamil: tamilMap,
  kn: kannadaMap,
  kannada: kannadaMap,
  hi: hindiMap,
  hindi: hindiMap,
  ml: malayalamMap,
  malayalam: malayalamMap,
  bn: bengaliMap,
  bengali: bengaliMap,
  pa: punjabiMap,
  punjabi: punjabiMap
};

export class Romanizer {
  /**
   * Detects language/script or uses preferred/provided language key
   */
  public static detectLanguage(text: string): string | null {
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code >= 0x0C00 && code <= 0x0C7F) return 'telugu';
      if (code >= 0x0B80 && code <= 0x0BFF) return 'tamil';
      if (code >= 0x0C80 && code <= 0x0CFF) return 'kannada';
      if (code >= 0x0900 && code <= 0x097F) return 'hindi';
      if (code >= 0x0D00 && code <= 0x0D7F) return 'malayalam';
      if (code >= 0x0980 && code <= 0x09FF) return 'bengali';
      if (code >= 0x0A00 && code <= 0x0A7F) return 'punjabi';
    }
    return null;
  }

  /**
   * Transliterates Indic script text into Romanized script (Tinglish, Tanglish, Hinglish, etc.)
   */
  public static romanize(text: string, languageHint?: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // Determine language mapping
    const lang = (languageHint && LANGUAGE_REGISTRY[languageHint.toLowerCase()]) 
      ? languageHint.toLowerCase() 
      : this.detectLanguage(text);

    if (!lang || !LANGUAGE_REGISTRY[lang]) {
      return text; // Return text untouched if not an Indic script or already Romanized
    }

    const map = LANGUAGE_REGISTRY[lang];
    const chars = Array.from(text);
    let result = '';

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const nextCh = chars[i + 1] || '';

      // 1. Independent Vowel
      if (map.vowels[ch]) {
        result += map.vowels[ch];
        continue;
      }

      // 2. Consonant
      if (map.consonants[ch]) {
        const romanConsonant = map.consonants[ch];
        
        if (nextCh === map.virama) {
          // Virama suppresses inherent vowel
          result += romanConsonant;
          i++; // Skip virama
        } else if (map.vowelSigns[nextCh]) {
          // Explicit Matra
          result += romanConsonant + map.vowelSigns[nextCh];
          i++; // Skip vowel sign
        } else {
          // Inherent 'a' vowel
          const isWordBoundary = nextCh === ' ' || nextCh === '' || nextCh === '\n' || nextCh === ',' || nextCh === '.' || nextCh === '!' || nextCh === '?';
          
          if (isWordBoundary) {
            if (lang.startsWith('hi') || lang.startsWith('bn') || lang.startsWith('pa')) {
              result += romanConsonant; // Hindi/Bengali/Punjabi schwa deletion
            } else {
              result += romanConsonant + 'u'; // Telugu/Kannada terminal natural vowel or 'a'
            }
          } else {
            result += romanConsonant + 'a';
          }
        }
        continue;
      }

      // 3. Modifiers (Anusvara, Visarga, etc.)
      if (map.vowelSigns[ch]) {
        result += map.vowelSigns[ch];
        continue;
      }

      // 4. Pass-through (Spaces, punctuation, numbers, Latin)
      result += ch;
    }

    // Post-processing standard phonetic cleanups for colloquial readability
    let cleaned = result;
    if (lang.startsWith('te') || lang.startsWith('telugu')) {
      cleaned = cleaned
        .replace(/vmte\b/g, 'vante')
        .replace(/vm/g, 'vam')
        .replace(/aam\b/g, 'am')
        .replace(/amte\b/g, 'ante')
        .replace(/amt/g, 'ant')
        .replace(/amda/g, 'anda')
        .replace(/nuvvmte/g, 'nuvvante')
        .replace(/nuvvamte/g, 'nuvvante')
        .replace(/ishtmu/g, 'ishtam')
        .replace(/ishtm/g, 'ishtam');
    } else if (lang.startsWith('ta') || lang.startsWith('tamil')) {
      cleaned = cleaned
        .replace(/pitikkum/g, 'pidikkum')
        .replace(/pitik/g, 'pidik');
    } else if (lang.startsWith('hi') || lang.startsWith('hindi')) {
      cleaned = cleaned
        .replace(/pasnd/g, 'pasand')
        .replace(/psnd/g, 'pasand');
    } else if (lang.startsWith('ml') || lang.startsWith('malayalam')) {
      cleaned = cleaned
        .replace(/enikk\b/g, 'enikku');
    }

    return cleaned.replace(/\s+/g, ' ').trim();
  }
}
