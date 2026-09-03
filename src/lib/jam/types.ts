export interface JamTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  addedBy: {
    userId: string;
    userName: string;
    avatarUrl?: string;
  };
  votes: string[]; // List of userIds who upvoted
}

export type JamQueueMessage =
  | { type: 'QUEUE_ADD'; track: JamTrack }
  | { type: 'QUEUE_REMOVE'; trackId: string }
  | { type: 'QUEUE_REORDER'; trackIds: string[] }
  | { type: 'VOTE_SKIP'; trackId: string; userId: string };
