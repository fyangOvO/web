import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

function rewriteUploadsUrl(obj: unknown): unknown {
  if (!obj) return obj;
  if (typeof obj === 'string') return obj.replace(/^\/uploads\//, '/api/uploads/');
  if (Array.isArray(obj)) return obj.map(rewriteUploadsUrl);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = rewriteUploadsUrl(v);
    return out;
  }
  return obj;
}
api.interceptors.response.use((r) => { if (r.data && typeof r.data === 'object') r.data = rewriteUploadsUrl(r.data); return r; });

export interface AlbumCategory {
  id: string;
  title: string;
  cover: string;
  desc: string;
  sort: number;
  /** 該分類是否有密碼保護（由後端返回，不暴露密碼哈希） */
  hasPassword?: boolean;
  /** 該分類下的照片數量（由後端統計返回） */
  photoCount?: number;
}

export interface AlbumPhoto {
  id: string;
  categoryId: string;
  url: string;
  caption: string;
  sort: number;
}

/* ================= 公開 API（需密碼 cookie） ================= */

export async function verifyAlbumPassword(password: string): Promise<boolean> {
  const r = await api.post('/album/verify', { password }, { withCredentials: true });
  return r.status === 200;
}

/** 驗證某個有密碼保護的相冊分類 */
export async function verifyCategoryPassword(categoryId: string, password: string): Promise<boolean> {
  const r = await api.post(`/album/categories/${categoryId}/verify`, { password }, { withCredentials: true });
  return r.status === 200;
}

export async function getAlbumCategories(): Promise<AlbumCategory[]> {
  const r = await api.get('/album/categories', { withCredentials: true });
  return r.data;
}

export async function getAlbumCategory(id: string): Promise<AlbumCategory> {
  const r = await api.get(`/album/categories/${id}`, { withCredentials: true });
  return r.data;
}

export async function getAlbumPhotos(categoryId: string): Promise<AlbumPhoto[]> {
  const r = await api.get(`/album/categories/${categoryId}/photos`, { withCredentials: true });
  return r.data;
}

/* ================= 後台管理 API（需 admin token） ================= */

let adminToken = '';
try {
  const raw = localStorage.getItem('admin_token');
  adminToken = raw && /^[0-9a-f]{32,}$/.test(raw) ? raw : '';
} catch {}

const adminApi = axios.create({ baseURL: '/api/admin', timeout: 15000 });
adminApi.interceptors.request.use((config) => {
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;
  return config;
});
adminApi.interceptors.response.use((r) => { if (r.data && typeof r.data === 'object') r.data = rewriteUploadsUrl(r.data); return r; });

export async function adminGetAlbumCategories(): Promise<AlbumCategory[]> {
  const r = await adminApi.get('/album/categories');
  return r.data;
}

export async function adminCreateAlbumCategory(data: { title: string; cover?: string; desc?: string; sort?: number; password?: string; passwordConfirm?: string }): Promise<AlbumCategory> {
  const r = await adminApi.post('/album/categories', data);
  return r.data;
}

export async function adminUpdateAlbumCategory(id: string, patch: Partial<AlbumCategory> & { password?: string; passwordConfirm?: string; clearPassword?: boolean }): Promise<AlbumCategory> {
  const r = await adminApi.put(`/album/categories/${id}`, patch);
  return r.data;
}

export async function adminDeleteAlbumCategory(id: string): Promise<{ ok: boolean }> {
  const r = await adminApi.delete(`/album/categories/${id}`);
  return r.data;
}

export async function adminGetAlbumPhotos(categoryId: string): Promise<AlbumPhoto[]> {
  const r = await adminApi.get(`/album/categories/${categoryId}/photos`);
  return r.data;
}

export async function adminUploadAlbumPhotos(categoryId: string, files: File[]): Promise<AlbumPhoto[]> {
  const fd = new FormData();
  fd.append('categoryId', categoryId);
  files.forEach((f) => fd.append('images', f));
  const r = await adminApi.post('/album/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}

export async function adminDeleteAlbumPhoto(id: string): Promise<{ ok: boolean }> {
  const r = await adminApi.delete(`/album/photos/${id}`);
  return r.data;
}

export async function adminUpdateAlbumPhoto(id: string, patch: Partial<Pick<AlbumPhoto, 'caption' | 'sort' | 'categoryId'>>): Promise<AlbumPhoto> {
  const r = await adminApi.put(`/album/photos/${id}`, patch);
  return r.data;
}
