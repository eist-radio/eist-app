// types/archive.ts

export type ProseMirrorNode = {
  type: string;
  text?: string;
  content?: ProseMirrorNode[];
};

export type ProseMirrorDoc = {
  type: 'doc';
  content?: ProseMirrorNode[];
};

export type MixcloudPictures = {
  small?: string;
  thumbnail?: string;
  medium_mobile?: string;
  medium?: string;
  large?: string;
  '320wx320h'?: string;
  extra_large?: string;
  '640wx640h'?: string;
  '768wx768h'?: string;
  '1024wx1024h'?: string;
};

export type MixcloudMatch = {
  slug: string;
  name: string;
  url: string;
  pictures?: MixcloudPictures;
  description?: string;
  score: number;
};

export type SoundcloudMatch = {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url?: string;
  description?: string;
  score: number;
};

export type ArchiveShow = {
  id: string;
  title: string;
  slug: string;
  start: string;
  end: string;
  artistIds?: string[];
  artistName: string;
  artistSlug: string;
  description?: ProseMirrorDoc;
  mixcloud_match?: MixcloudMatch | null;
  soundcloud_match?: SoundcloudMatch | null;
  match_score: number;
  episode_info?: any;
};

export type DerivedArtist = {
  slug: string;
  name: string;
  showCount: number;
  imageUrl?: string | null;
};

export type ArchiveSection = {
  key: string; // YYYY-MM for sorting
  title: string; // "January 2025"
  data: ArchiveShow[];
};
