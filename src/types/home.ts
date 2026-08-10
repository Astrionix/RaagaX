import { Song } from './music';

export type ShelfType = 'quick_access' | 'carousel' | 'list_chart';

export interface ShelfItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: 'song' | 'playlist' | 'album' | 'artist' | 'mix';
  actionData?: any; // E.g., song ID to play, or playlist ID to open
  rawItem?: any;
}

export interface HomeSection {
  id: string;
  type: ShelfType;
  title?: string;
  items: ShelfItem[];
}

export interface HomePayload {
  greeting: string;
  sections: HomeSection[];
}
