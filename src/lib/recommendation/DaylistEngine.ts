import { Song } from '@/types/music';

export interface DaylistPayload {
  title: string;
  tagline: string;
  badge: string;
  gradient: string;
  accentColor: string;
  borderColor: string;
  badgeBg: string;
  vibe: 'morning' | 'afternoon' | 'evening' | 'night';
}

export class DaylistEngine {
  public static getDaylistInfo(): DaylistPayload {
    const hour = new Date().getHours();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[new Date().getDay()];

    if (hour >= 5 && hour < 12) {
      return {
        title: `acoustic sunrise ${currentDay} morning`,
        tagline: 'Fresh energy, acoustic pop & morning melodies',
        badge: 'DAYLIST • MORNING',
        gradient: 'from-amber-500/25 via-orange-950/20 to-black/80',
        accentColor: 'text-amber-400',
        borderColor: 'border-amber-500/30 hover:border-amber-500/60',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        vibe: 'morning',
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        title: `lo-fi focus ${currentDay} afternoon`,
        tagline: 'Instrumental beats, deep focus & lofi acoustics',
        badge: 'DAYLIST • AFTERNOON',
        gradient: 'from-cyan-600/25 via-teal-950/20 to-black/80',
        accentColor: 'text-cyan-400',
        borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        vibe: 'afternoon',
      };
    } else if (hour >= 17 && hour < 21) {
      return {
        title: `melodic romance ${currentDay} evening`,
        tagline: 'Warm melodies, romantic hits & sunset vibes',
        badge: 'DAYLIST • EVENING',
        gradient: 'from-rose-600/25 via-purple-950/20 to-black/80',
        accentColor: 'text-rose-400',
        borderColor: 'border-rose-500/30 hover:border-rose-500/60',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        vibe: 'evening',
      };
    } else {
      return {
        title: `synthwave midnight ${currentDay} night`,
        tagline: 'Chill ambient, deep synthwave & late night unplugged',
        badge: 'DAYLIST • LATE NIGHT',
        gradient: 'from-indigo-600/25 via-violet-950/20 to-black/80',
        accentColor: 'text-indigo-400',
        borderColor: 'border-indigo-500/30 hover:border-indigo-500/60',
        badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        vibe: 'night',
      };
    }
  }
}
