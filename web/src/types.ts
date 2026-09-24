export interface FriendLink {
  id?: string;
  name: string;
  url: string;
  desc?: string;
  visible?: boolean;
  date?: string;
}

/** 网易云音乐歌曲信息 */
export interface MusicSong {
  id: string;
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number; // 秒
}

/** 解析后的歌词行 */
export interface LyricLine {
  time: number; // 秒
  text: string;
  /** 该行结束时间（秒）；由下一行起始时间推算，末行用 duration 兜底 */
  end?: number;
  /** 逐字时间轴：每个字符的起始秒数（由行时长等分插值推算） */
  charTimes?: number[];
}

export interface NavLinkItem {
  id?: string;
  category: string;
  name: string;
  url: string;
  desc?: string;
  icon?: string;
  sort?: number;
}

export interface NavLinksData {
  categories: string[];
  links: NavLinkItem[];
}

export interface MapInfo {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  zoom?: number;
}

export interface SiteStats {
  postCount: number;
  wordCount: number;
  startDate: string;
  lastUpdate: string | null;
}

export interface Profile {
  name: string;
  title: string;
  location: string;
  email: string;
  avatarText: string;
  avatar?: string;
  tagline: string[];
  bio: string[];
  socials: { name: string; url: string }[];
  stats: { label: string; value: string }[];
  hobbies: string[];
  info: { label: string; value: string }[];
}

export interface Skill {
  id: string;
  category: string;
  icon: string;
  desc: string;
  items: string[];
}

export interface Project {
  id: string;
  title: string;
  desc: string;
  tech: string[];
  tags: string[];
  repo: string;
  demo: string;
  featured: boolean;
  gradient: string;
  icon: string;
}

export interface PostBlock {
  type: string;
  content?: string;
  items?: string[];
  lang?: string;
}

export interface Post {
  id: string;
  category?: 'blog' | 'essay';
  title: string;
  date: string;
  tags: string[];
  summary: string;
  readMinutes: number;
  blocks?: PostBlock[];
}

export interface TimelineItem {
  period: string;
  role: string;
  org: string;
  desc: string;
}

export interface Message {
  id: string;
  name: string;
  content: string;
  date: string;
  visible?: boolean;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  date: string;
  read: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  author: string;
  likes: number;
  date: string;
  visible?: boolean;
}

export interface Comment {
  id: string;
  noteId: string;
  name: string;
  content: string;
  date: string;
  visible?: boolean;
}
