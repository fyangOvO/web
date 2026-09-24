/**
 * 网易云音乐前端 API 层
 * - 复用 web/src/api/index.ts 中的 axios 实例 `api`（baseURL=/api）
 * - search/lyric/detail：JSON
 * - stream：返回 URL 字串交由 <audio> 直接使用
 */
import { api } from './index';
import type { MusicSong } from '../types';

/** 网易云搜索结果原始项 -> MusicSong */
function mapNeteaseSong(raw: Record<string, unknown>): MusicSong {
  const ar = Array.isArray(raw.artists) ? (raw.artists as Array<{ name?: string }>) : [];
  const al = raw.album as { name?: string; picUrl?: string } | undefined;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    artist: ar.map((a) => a.name || '').filter(Boolean).join(' / ') || '未知艺术家',
    album: al?.name,
    cover: al?.picUrl,
    duration: typeof raw.duration === 'number' ? Math.floor(raw.duration / 1000) : undefined,
  };
}

export async function searchMusic(keyword: string, limit = 20): Promise<MusicSong[]> {
  if (!keyword.trim()) return [];
  const { data } = await api.get('/music/search', {
    params: { s: keyword, limit },
  });
  const songs = (data?.result?.songs || []) as Array<Record<string, unknown>>;
  return songs.map(mapNeteaseSong);
}

/**
 * 批量查询可播放性。
 * 返回 { [songId]: boolean }；查询失败时返回空对象（前端不标注即可，不阻塞）。
 */
export async function checkPlayable(ids: string[]): Promise<Record<string, boolean>> {
  const list = ids.filter(Boolean).slice(0, 50);
  if (!list.length) return {};
  try {
    const { data } = await api.get('/music/playable', {
      params: { ids: list.join(',') },
    });
    return (data?.playable || {}) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** 歌曲受限信息（403 时后端返回的结构） */
export interface MusicRestrictedInfo {
  restricted: boolean;
  detail?: string;
  hint?: string;
}

/**
 * 探测某首歌是否受限（用于播放前预检，避免 <audio> 拿到 JSON 报错）。
 * 用 Range 请求只取 1 字节，代价极小。
 */
export async function probeSong(id: string): Promise<MusicRestrictedInfo> {
  if (!id) return { restricted: false };
  try {
    const res = await fetch(getMusicStreamUrl(id), {
      headers: { Range: 'bytes=0-0' },
    });
    if (res.status === 403) {
      const j = await res.json().catch(() => ({}));
      return {
        restricted: true,
        detail: j?.detail || '此歌曲因版权限制无法播放',
        hint: j?.hint || '请换一首歌试试',
      };
    }
    return { restricted: false };
  } catch {
    return { restricted: false };
  }
}

/** 歌词原始数据：原文 + 翻译（有则用） */
export interface MusicLyricRaw {
  lrc: string;
  tlyric: string;
}

/**
 * 取歌词。
 * 说明：网易云公开接口现已不下发逐字时间轴（klyric/yrc 恒为空），
 * 因此只用逐行 lrc；翻译 tlyric 若存在则一并带回，供后续双语展示。
 */
export async function getMusicLyric(id: string): Promise<MusicLyricRaw> {
  if (!id) return { lrc: '', tlyric: '' };
  const { data } = await api.get('/music/lyric', { params: { id } });
  return {
    lrc: String(data?.lrc?.lyric || ''),
    tlyric: String(data?.tlyric?.lyric || ''),
  };
}

export async function getMusicDetail(id: string): Promise<MusicSong | null> {
  if (!id) return null;
  const { data } = await api.get('/music/detail', { params: { id } });
  const songs = (data?.songs || []) as Array<Record<string, unknown>>;
  if (!songs.length) return null;
  const first = songs[0];
  const ar = Array.isArray(first.artists)
    ? (first.artists as Array<{ name?: string }>)
    : Array.isArray(first.ar)
      ? (first.ar as Array<{ name?: string }>)
      : [];
  const al = (first.album || first.al) as { name?: string; picUrl?: string } | undefined;
  return {
    id: String(first.id ?? id),
    name: String(first.name ?? ''),
    artist: ar.map((a) => a.name || '').filter(Boolean).join(' / ') || '未知艺术家',
    album: al?.name,
    cover: al?.picUrl,
    duration: typeof first.duration === 'number' ? Math.floor(first.duration / 1000) : undefined,
  };
}

/** 取得音频流 URL（交由 <audio> src 使用，不主动请求） */
export function getMusicStreamUrl(id: string): string {
  return `/api/music/stream?id=${encodeURIComponent(id)}`;
}
