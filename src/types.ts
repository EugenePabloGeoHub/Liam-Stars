import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
}

export interface Game {
  id: string;
  title: string;
  code: string;
  authorId: string;
  authorName: string;
  likes: number;
  views: number;
  createdAt: Timestamp;
}

export interface Like {
  userId: string;
  gameId: string;
  createdAt: Timestamp;
}
