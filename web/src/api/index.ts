import axios from 'axios';
import type {
  Profile,
  Skill,
  Project,
  Post,
  TimelineItem,
  Message,
  ContactMessage,
  Note,
  Comment,
  FriendLink,
  SiteStats,
  NavLinkItem,
  NavLinksData,
  MapInfo,
} from '../types';
import type { Plan, PlanCategory } from '../data/plans';

export type { Profile };

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 统一把后端返回的 /uploads/xxx 转成 /api/uploads/xxx（绕开 nginx 正则 location 优先级问题）
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
api.interceptors.response.use((r) => {
  if (r.data && typeof r.data === 'object') r.data = rewriteUploadsUrl(r.data);
  return r;
});

export async function getProfile(): Promise<Profile> {
  return (await api.get('/profile')).data;
}

/* ---------------- 拾句（今日诗词 / 一言） ---------------- */

export interface PoemData {
  content: string;
  origin: string;
  author: string;
  category: string;
}

export interface HitokotoData {
  text: string;
  from: string;
  fromWho: string;
  type: string;
}

/** 今日诗词；force=true 跳过后端缓存，用于「换一首」 */
export async function getVersePoem(force = false): Promise<PoemData> {
  return (await api.get('/verse/poem', { params: force ? { refresh: '1' } : {} })).data;
}

/** 一言，c 为空表示全部分类 */
export async function getHitokoto(c?: string): Promise<HitokotoData> {
  return (await api.get('/verse/hitokoto', { params: c ? { c } : {} })).data;
}

export async function getSkills(): Promise<Skill[]> {
  return (await api.get('/skills')).data;
}

export async function getProjects(featured = false): Promise<Project[]> {
  return (await api.get('/projects', { params: featured ? { featured: 1 } : {} })).data;
}

export async function getPosts(limit?: number, category?: 'blog' | 'essay'): Promise<Post[]> {
  return (
    await api.get('/posts', {
      params: { limit: limit ?? undefined, category: category ?? undefined },
    })
  ).data;
}

export async function getPostsByTag(tag: string, category?: 'blog' | 'essay'): Promise<Post[]> {
  return (
    await api.get('/posts', {
      params: { tag, category: category ?? undefined },
    })
  ).data;
}

export async function getPost(id: string): Promise<Post> {
  return (await api.get(`/posts/${id}`)).data;
}

export async function getFriendLinks(): Promise<FriendLink[]> {
  return (await api.get('/friend-links')).data;
}

export async function applyFriendLink(data: {
  name: string;
  url: string;
  desc?: string;
  website?: string;
}): Promise<{ ok: boolean; pending: boolean }> {
  return (await api.post('/friend-links/apply', data)).data;
}

export async function getStats(): Promise<SiteStats> {
  return (await api.get('/stats')).data;
}

export async function getNavLinks(): Promise<NavLinksData> {
  return (await api.get('/nav-links')).data;
}

export async function getMapInfo(): Promise<MapInfo> {
  return (await api.get('/map')).data;
}

export async function adminGetFriendLinks(): Promise<FriendLink[]> {
  return (await adminApi.get('/friend-links')).data;
}

export async function adminCreateFriendLink(data: {
  name: string;
  url: string;
  desc?: string;
  visible?: boolean;
}): Promise<FriendLink> {
  return (await adminApi.post('/friend-links', data)).data;
}

export async function adminUpdateFriendLink(
  id: string,
  patch: Partial<{ name: string; url: string; desc: string; visible: boolean }>
): Promise<FriendLink> {
  return (await adminApi.patch(`/friend-links/${id}`, patch)).data;
}

export async function adminDeleteFriendLink(id: string): Promise<{ ok: boolean }> {
  return (await adminApi.delete(`/friend-links/${id}`)).data;
}

export async function getTimeline(): Promise<TimelineItem[]> {
  return (await api.get('/timeline')).data;
}

export async function getMessages(): Promise<Message[]> {
  return (await api.get('/messages')).data;
}

export async function postMessage(payload: {
  name: string;
  content: string;
  website?: string;
}): Promise<Message> {
  return (await api.post('/messages', payload)).data;
}

export async function postContact(payload: {
  name: string;
  email: string;
  message: string;
  website?: string;
}): Promise<{ ok: boolean }> {
  return (await api.post('/contact', payload)).data;
}

/* ================= 后台管理 API（/api/admin，需 token） ================= */

let adminToken = '';
try {
  const raw = localStorage.getItem('admin_token');
  adminToken = raw && /^[0-9a-f]{32,}$/.test(raw) ? raw : '';
  if (raw && !adminToken) {
    console.warn('[admin] 本地存储的 token 格式异常，已忽略（请重新登录）');
    localStorage.removeItem('admin_token');
  }
} catch {
  /* ignore */
}

export function setAdminToken(token: string) {
  adminToken = token;
  try {
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
  } catch {
    /* ignore */
  }
}

export function getAdminToken() {
  return adminToken;
}

const adminApi = axios.create({ baseURL: '/api/admin', timeout: 15000 });

adminApi.interceptors.request.use((config) => {
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;
  return config;
});
adminApi.interceptors.response.use((r) => {
  if (r.data && typeof r.data === 'object') r.data = rewriteUploadsUrl(r.data);
  return r;
});

export async function adminLogin(password: string): Promise<{ token: string }> {
  return (await api.post('/admin/login', { password })).data;
}

export async function adminMe(): Promise<{ ok: boolean }> {
  return (await adminApi.get('/me')).data;
}

export async function adminLogout(): Promise<{ ok: boolean }> {
  return (await adminApi.post('/logout')).data;
}

/** 修改后台密码：旧密码 + 新密码，新密码持久化到 db.json.adminPassword */
export async function adminChangePassword(payload: {
  oldPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  return (await adminApi.post('/change-password', payload)).data;
}

/* ---------- 站点设置 ---------- */

/* ---------------- 相冊版面配置 ---------------- */

/** 相冊牆（相冊列表頁）的擺放風格 */
export type AlbumWallLayout = 'grid' | 'masonry' | 'tilt';
/** 相冊內照片的擺放風格 */
export type AlbumPhotoLayout = 'masonry' | 'grid';
/** 列數：auto 表示依螢幕寬度自適應 */
export type AlbumCols = 'auto' | number;
/** 卡片尺寸 */
export type AlbumSize = 'sm' | 'md' | 'lg';
/** 元素間距 */
export type AlbumGap = 'sm' | 'md' | 'lg';
/** 等寬網格模式下的裁剪比例 */
export type AlbumRatio = 'original' | 'square' | '4:3' | '3:4' | '16:9';

export interface AlbumWallSettings {
  layout: AlbumWallLayout;
  columns: AlbumCols;
  size: AlbumSize;
  /** 錯落旋轉角度（度），僅 tilt 風格生效 */
  tilt: number;
  /** 是否顯示照片數量角標 */
  showCount: boolean;
  /** 是否顯示相冊描述 */
  showDesc: boolean;
}

export interface AlbumPhotoSettings {
  layout: AlbumPhotoLayout;
  columns: AlbumCols;
  gap: AlbumGap;
  /** 僅 grid 佈局生效；original 表示保留原圖比例 */
  ratio: AlbumRatio;
  rounded: boolean;
}

export interface AlbumLayout {
  wall: AlbumWallSettings;
  photos: AlbumPhotoSettings;
}

export interface SiteSettings {
  fancyButtons: boolean;
  showCarousel: boolean;
  carouselPaginate: boolean;
  carouselInterval: number;
  /** 点击页面效果总开关（false 时前台完全不挂载粒子层） */
  clickEffectEnabled: boolean;
  clickEffect: 'hearts' | 'burst' | 'sparkle' | 'custom';
  customClickImage: string;
  /** 点击粒子大小倍率 0.5~2.5（1 = 原始尺寸） */
  clickEffectSize: number;
  /** 点击粒子的发光样式 */
  clickEffectGlow: 'none' | 'soft' | 'strong' | 'neon';
  /** 粒子发光强度 0~100 */
  clickEffectGlowIntensity: number;
  /** 是否使用多色（关闭则只用主题色） */
  clickEffectMulticolor: boolean;
  musicEnabled: boolean;
  /** 播放器皮肤 key（见 composables/useMusicSkin.ts 的 MUSIC_SKINS） */
  musicSkin:
    | 'default' | 'glass' | 'frosted' | 'light' | 'midnight'
    | 'dark' | 'sunset' | 'neon' | 'paper' | 'custom';
  musicSkinBg: string;
  /** 自定义图片皮肤的蒙层不透明度 0~100 */
  musicSkinOpacity: number;
  /** 面板模糊度 0~40px */
  musicSkinBlur: number;
  backgroundType: string;
  // 看板娘
  companionEnabled: boolean;
  companionSkin: 'default' | 'cat' | 'bunny' | 'bear' | 'panda' | 'fox' | 'avatar' | 'custom';
  companionIdleAnim: 'bob' | 'sway' | 'breathe' | 'none' | 'custom';
  companionIdleAnimImage: string;
  companionCustomImage: string;
  companionSays: string[];
  // 字体
  siteFont: string;
  // 语言
  siteLanguage: 'zh-Hant' | 'zh-Hans' | 'en';
  // 导航栏
  navItems: { to: string; label: string; icon?: string; hidden?: boolean }[] | null;
  // 相冊版面配置
  albumLayout: AlbumLayout;
}

/** 公开获取站点设置（前台页面读取） */
export async function getSettings(): Promise<SiteSettings> {
  return (await api.get('/settings')).data;
}

/** 管理端获取站点设置 */
export async function adminGetSettings(): Promise<SiteSettings> {
  return (await adminApi.get('/settings')).data;
}

/** 管理端更新站点设置 */
export async function adminUpdateSettings(payload: Partial<SiteSettings>): Promise<{ ok: boolean }> {
  return (await adminApi.put('/settings', payload)).data;
}

export async function adminGetPosts(): Promise<Post[]> {
  return (await adminApi.get('/posts')).data;
}

export async function adminCreatePost(payload: Partial<Post>): Promise<Post> {
  return (await adminApi.post('/posts', payload)).data;
}

export async function adminUpdatePost(id: string, payload: Partial<Post>): Promise<Post> {
  return (await adminApi.put(`/posts/${id}`, payload)).data;
}

export async function adminDeletePost(id: string): Promise<void> {
  await adminApi.delete(`/posts/${id}`);
}

export async function adminGetProjects(): Promise<Project[]> {
  return (await adminApi.get('/projects')).data;
}

export async function adminCreateProject(payload: Partial<Project>): Promise<Project> {
  return (await adminApi.post('/projects', payload)).data;
}

export async function adminUpdateProject(id: string, payload: Partial<Project>): Promise<Project> {
  return (await adminApi.put(`/projects/${id}`, payload)).data;
}

export async function adminDeleteProject(id: string): Promise<void> {
  await adminApi.delete(`/projects/${id}`);
}

export async function adminGetMessages(): Promise<Message[]> {
  return (await adminApi.get('/messages')).data;
}

export async function adminToggleMessage(id: string, visible: boolean): Promise<Message> {
  return (await adminApi.patch(`/messages/${id}`, { visible })).data;
}

export async function adminDeleteMessage(id: string): Promise<void> {
  await adminApi.delete(`/messages/${id}`);
}

export async function adminGetContacts(): Promise<ContactMessage[]> {
  return (await adminApi.get('/contact-messages')).data;
}

export async function adminMarkContactRead(id: string, read: boolean): Promise<ContactMessage> {
  return (await adminApi.patch(`/contact-messages/${id}`, { read })).data;
}

export async function adminDeleteContact(id: string): Promise<void> {
  await adminApi.delete(`/contact-messages/${id}`);
}

export async function adminUpdateProfile(payload: Partial<Profile>): Promise<Profile> {
  return (await adminApi.put('/profile', payload)).data;
}

/* ================= 图文笔记 API ================= */

export async function getNotes(tag?: string): Promise<Note[]> {
  return (await api.get('/notes', { params: tag ? { tag } : undefined })).data;
}

export async function likeNote(id: string, action: 'like' | 'unlike'): Promise<{ likes: number }> {
  return (await api.post(`/notes/${id}/like`, { action })).data;
}

export async function adminGetNotes(): Promise<Note[]> {
  return (await adminApi.get('/notes')).data;
}

export async function adminUploadNoteImages(files: File[]): Promise<{ urls: string[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  return (await adminApi.post('/notes/upload', fd)).data;
}

export async function adminUploadImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return (await adminApi.post('/upload/image', fd)).data;
}

/** 后台上传轮播视频（mp4 / webm / mov），≤ 50MB */
export async function adminUploadBannerVideo(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return (await adminApi.post('/upload/video', fd)).data;
}

export async function adminCreateNote(payload: Partial<Note>): Promise<Note> {
  return (await adminApi.post('/notes', payload)).data;
}

export async function adminUpdateNote(id: string, payload: Partial<Note>): Promise<Note> {
  return (await adminApi.put(`/notes/${id}`, payload)).data;
}

export async function adminToggleNote(id: string, visible: boolean): Promise<Note> {
  return (await adminApi.patch(`/notes/${id}`, { visible })).data;
}

export async function adminDeleteNote(id: string): Promise<void> {
  await adminApi.delete(`/notes/${id}`);
}

/* ================= 评论 API ================= */

export async function getNoteComments(noteId: string): Promise<Comment[]> {
  return (await api.get(`/notes/${noteId}/comments`)).data;
}

export async function postNoteComment(
  noteId: string,
  payload: { name: string; content: string; website?: string }
): Promise<Comment> {
  return (await api.post(`/notes/${noteId}/comments`, payload)).data;
}

export async function adminGetComments(): Promise<Comment[]> {
  return (await adminApi.get('/comments')).data;
}

export async function adminToggleComment(id: string, visible: boolean): Promise<Comment> {
  return (await adminApi.patch(`/comments/${id}`, { visible })).data;
}

export async function adminDeleteComment(id: string): Promise<void> {
  await adminApi.delete(`/comments/${id}`);
}

/* ============== Admin Nav CRUD ============== */

export async function adminGetNavLinks(): Promise<NavLinksData> {
  const { data } = await adminApi.get<NavLinksData>('/nav-links');
  return data;
}

export async function adminCreateNavCategory(name: string): Promise<string[]> {
  const { data } = await adminApi.post<{ data: string[] }>('/nav-categories', { name });
  return data.data;
}

export async function adminRenameNavCategory(oldName: string, newName: string): Promise<NavLinksData> {
  const { data } = await adminApi.put<{ data: NavLinksData }>(
    `/nav-categories/${encodeURIComponent(oldName)}`,
    { name: newName },
  );
  return data.data;
}

export async function adminDeleteNavCategory(name: string): Promise<NavLinksData> {
  const { data } = await adminApi.delete<{ data: NavLinksData }>(
    `/nav-categories/${encodeURIComponent(name)}`,
  );
  return data.data;
}

export async function adminCreateNavLink(link: Omit<NavLinkItem, 'id'>): Promise<NavLinkItem> {
  const { data } = await adminApi.post<{ data: NavLinkItem }>('/nav-links', link);
  return data.data;
}

export async function adminUpdateNavLink(id: string, patch: Partial<NavLinkItem>): Promise<NavLinkItem> {
  const { data } = await adminApi.put<{ data: NavLinkItem }>(`/nav-links/${id}`, patch);
  return data.data;
}

export async function adminDeleteNavLink(id: string): Promise<void> {
  await adminApi.delete(`/nav-links/${id}`);
}

export async function adminReorderNavLinks(links: { id: string; sort: number; category?: string }[]): Promise<void> {
  await adminApi.put('/nav-links/batch-reorder', { links });
}

/* ---------------- 轮播图（banners）管理 ---------------- */

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  to: string;
  image: string;
  /** 背景视频（mp4/webm/mov），存在时优先于 image 播放。 */
  video?: string;
  gradient: string;
  kind: string;
  sort: number;
  visible: boolean;
  /** 前台是否显示左上角「博客/随笔/...」分类标签。默认 true。 */
  showKind?: boolean;
  showTitle: boolean;
  showSubtitle: boolean;
  showDesc: boolean;
  titleSize: number;
  titleWeight: string;
  titleColor: string;
  subtitleSize: number;
  subtitleColor: string;
  descSize: number;
  descColor: string;
  textPosition: string;
  textAlign: string;
  textOffsetY: number;
}

export async function adminGetBanners(): Promise<Banner[]> {
  return (await adminApi.get('/banners')).data;
}

export async function adminCreateBanner(data: Partial<Banner>): Promise<Banner> {
  return (await adminApi.post('/banners', data)).data;
}

export async function adminUpdateBanner(id: string, data: Partial<Banner>): Promise<Banner> {
  return (await adminApi.put(`/banners/${id}`, data)).data;
}

export async function adminPatchBanner(id: string, patch: { visible?: boolean; sort?: number }): Promise<Banner> {
  return (await adminApi.patch(`/banners/${id}`, patch)).data;
}

export async function adminDeleteBanner(id: string): Promise<{ ok: boolean }> {
  return (await adminApi.delete(`/banners/${id}`)).data;
}

/* ---------------- 计划（Plan） ---------------- */

/** 公开：已发布的计划列表（按 sort 升序） */
export async function getPlans(): Promise<Plan[]> {
  return (await api.get('/plans')).data;
}

/** 公开：单个计划详情 */
export async function getPlan(id: string): Promise<Plan> {
  return (await api.get(`/plans/${id}`)).data;
}

export async function adminGetPlans(): Promise<Plan[]> {
  return (await adminApi.get('/plans')).data;
}

export async function adminCreatePlan(data: Partial<Plan>): Promise<Plan> {
  return (await adminApi.post('/plans', data)).data;
}

export async function adminUpdatePlan(id: string, data: Partial<Plan>): Promise<Plan> {
  return (await adminApi.put(`/plans/${id}`, data)).data;
}

export async function adminPatchPlan(
  id: string,
  patch: { visible?: boolean; sort?: number }
): Promise<Plan> {
  return (await adminApi.patch(`/plans/${id}`, patch)).data;
}

export async function adminDeletePlan(id: string): Promise<{ ok: boolean }> {
  return (await adminApi.delete(`/plans/${id}`)).data;
}

/**
 * 上传 Markdown / HTML 计划文档 → 后端解析成计划草稿（不落库）。
 * 前端拿到草稿后预填编辑弹窗，确认后再调 adminCreatePlan 保存。
 */
export async function adminParsePlanFile(
  file: File,
  category?: PlanCategory
): Promise<{ plan: Plan; filename: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  if (category) fd.append('category', category);
  return (await adminApi.post('/plans/parse', fd)).data;
}

/** 把前端内置的计划一键导入数据库（首次启用后台管理时用） */
export async function adminImportBuiltinPlans(
  items: Plan[]
): Promise<{ ok: boolean; added: number; skipped: number; total: number }> {
  return (await adminApi.post('/plans/import-builtin', { plans: items })).data;
}

/** 计划库是否已在后台初始化（未初始化时前端用内置数据兜底） */
export async function getPlansSeedState(): Promise<{ seeded: boolean; count: number }> {
  return (await api.get('/plans-seed-state')).data;
}
