/**
 * 个人网站 Node.js API 服务
 * - Express 4 + CORS
 * - JSON 文件存储（server/data/db.json）
 * - 留言板 / 联系表单：字段校验 + 敏感词过滤 + honeypot 反垃圾
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { readDb, saveDb, nextId } = require('./store');
const { filterSensitive, validateMessage, validateContact } = require('./validate');
const musicRouter = require('./music');
const { parsePlanDocument } = require('./planParser');

const app = express();
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

/* ---------------- 图文上传（静态目录） ---------------- */

/* ---------------- 网易云音乐代理 ---------------- */
app.use('/api/music', musicRouter);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
// 兜底：通过 /api/uploads/* 也能访问（绕开 nginx 正则 location 优先级问题）
app.get('/api/uploads/*', (req, res) => {
  const file = path.basename(req.params[0]);
  const fullPath = path.join(UPLOAD_DIR, file);
  res.sendFile(fullPath, { maxAge: '7d' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: '文件不存在' });
  });
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB/张
const MAX_FILES = 9; // 最多 9 张

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 JPG / PNG / WebP / GIF 图片'));
  },
});

// 简易请求日志
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[api] ${req.method} ${req.path}`);
  }
  next();
});

// 统一禁止浏览器缓存所有 /api 响应，确保后台修改后前端即时生效
// 静态资源（/uploads）已有自己的 maxAge，不受此中间件影响
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* ---------------- 只读内容接口 ---------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------------- 拾句：今日诗词 / 一言（外部免费接口 + 缓存代理） ---------------- */
const HITOKOTO_TYPES = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
// 今日诗词每日一变，缓存 30 分钟足够，避免每个访客都打上游
const poemCache = { at: 0, data: null };
const POEM_TTL = 30 * 60 * 1000;

/** 今日诗词（jinrishici） */
app.get('/api/verse/poem', async (req, res) => {
  // refresh=1 由「换一首」触发，跳过缓存立刻取新的一首
  const force = req.query.refresh === '1';
  if (!force && poemCache.data && Date.now() - poemCache.at < POEM_TTL) {
    return res.json(poemCache.data);
  }
  try {
    const r = await fetch('https://v1.jinrishici.com/all.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    const data = {
      content: String(j.content || '').trim(),
      origin: String(j.origin || '').trim(),
      author: String(j.author || '').trim(),
      category: String(j.category || '').trim(),
    };
    if (!data.content) throw new Error('empty');
    poemCache.at = Date.now();
    poemCache.data = data;
    res.json(data);
  } catch {
    if (poemCache.data) return res.json(poemCache.data); // 上游挂了就退回上一首
    res.status(502).json({ error: '诗词服务暂时不可用' });
  }
});

/** 一言（hitokoto），c 为分类：a动画 b漫画 c游戏 d文学 e原创 f网络 g其他 h影视 i诗词 j网易云 k哲学 l抖机灵 */
app.get('/api/verse/hitokoto', async (req, res) => {
  const raw = String(req.query.c || '').trim();
  const c = HITOKOTO_TYPES.has(raw) ? raw : '';
  const url = `https://v1.hitokoto.cn/?encode=json${c ? `&c=${c}` : ''}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    res.json({
      text: String(j.hitokoto || '').trim(),
      from: String(j.from || '').trim(),
      fromWho: String(j.from_who || '').trim(),
      type: String(j.type || '').trim(),
    });
  } catch {
    res.status(502).json({ error: '一言服务暂时不可用' });
  }
});

/* ---------------- 相冊版面配置（後台可調） ----------------
 * wall   —— 相冊列表頁（相冊牆）的擺放效果
 * photos —— 單個相冊內部照片的擺放效果
 */
const ALBUM_WALL_LAYOUTS = ['grid', 'masonry', 'tilt'];
const ALBUM_PHOTO_LAYOUTS = ['masonry', 'grid'];
const ALBUM_SIZES = ['sm', 'md', 'lg'];
const ALBUM_GAPS = ['sm', 'md', 'lg'];
const ALBUM_RATIOS = ['original', 'square', '4:3', '3:4', '16:9'];

const DEFAULT_ALBUM_LAYOUT = {
  wall: { layout: 'tilt', columns: 'auto', size: 'md', tilt: 4, showCount: true, showDesc: true },
  photos: { layout: 'masonry', columns: 'auto', gap: 'md', ratio: 'original', rounded: true },
};

function clampInt(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** 列數：允許 'auto' 或指定整數 */
function pickCols(v, lo, hi, dflt) {
  if (v === 'auto') return 'auto';
  return clampInt(v, lo, hi, dflt);
}

/** 把任意輸入收斂成合法的相冊版面配置（白名單 + 默認值兜底） */
function sanitizeAlbumLayout(input, base) {
  const b = base && typeof base === 'object' ? base : DEFAULT_ALBUM_LAYOUT;
  const bw = b.wall || DEFAULT_ALBUM_LAYOUT.wall;
  const bp = b.photos || DEFAULT_ALBUM_LAYOUT.photos;
  const w = input && typeof input.wall === 'object' && input.wall ? input.wall : {};
  const p = input && typeof input.photos === 'object' && input.photos ? input.photos : {};
  return {
    wall: {
      layout: ALBUM_WALL_LAYOUTS.includes(w.layout) ? w.layout : bw.layout,
      columns: pickCols(w.columns, 2, 5, bw.columns),
      size: ALBUM_SIZES.includes(w.size) ? w.size : bw.size,
      tilt: clampInt(w.tilt, 0, 10, bw.tilt),
      showCount: typeof w.showCount === 'boolean' ? w.showCount : bw.showCount,
      showDesc: typeof w.showDesc === 'boolean' ? w.showDesc : bw.showDesc,
    },
    photos: {
      layout: ALBUM_PHOTO_LAYOUTS.includes(p.layout) ? p.layout : bp.layout,
      columns: pickCols(p.columns, 2, 6, bp.columns),
      gap: ALBUM_GAPS.includes(p.gap) ? p.gap : bp.gap,
      ratio: ALBUM_RATIOS.includes(p.ratio) ? p.ratio : bp.ratio,
      rounded: typeof p.rounded === 'boolean' ? p.rounded : bp.rounded,
    },
  };
}

/** 站点公开设置：特效按钮开关、轮播显示开关、点击效果、音乐等 */
app.get('/api/settings', (_req, res) => {
  // 版面配置等需要即改即生效，禁止浏览器缓存
  res.set('Cache-Control', 'no-store');
  const s = readDb().settings || {};
  res.json({
    fancyButtons: !!s.fancyButtons,
    showCarousel: s.showCarousel !== false,
    carouselPaginate: s.carouselPaginate !== false,
    carouselInterval: s.carouselInterval || 5000,
    clickEffectEnabled: s.clickEffectEnabled !== false,
    clickEffect: s.clickEffect || 'hearts',
    customClickImage: s.customClickImage || '',
    clickEffectSize: typeof s.clickEffectSize === 'number' ? s.clickEffectSize : 1,
    clickEffectGlow: s.clickEffectGlow || 'soft',
    clickEffectGlowIntensity:
      typeof s.clickEffectGlowIntensity === 'number' ? s.clickEffectGlowIntensity : 60,
    clickEffectMulticolor: s.clickEffectMulticolor !== false,
    musicEnabled: s.musicEnabled !== false,
    musicSkin: s.musicSkin || 'default',
    musicSkinBg: s.musicSkinBg || '',
    musicSkinOpacity: typeof s.musicSkinOpacity === 'number' ? s.musicSkinOpacity : 85,
    musicSkinBlur: typeof s.musicSkinBlur === 'number' ? s.musicSkinBlur : 12,
    backgroundType: s.backgroundType || 'aurora',
    // 看板娘
    companionEnabled: s.companionEnabled !== false,
    companionSkin: s.companionSkin || 'default',
    companionIdleAnim: s.companionIdleAnim || 'bob',
    companionCustomImage: s.companionCustomImage || '',
    companionIdleAnimImage: s.companionIdleAnimImage || '',
    companionSays: Array.isArray(s.companionSays) ? s.companionSays : [],
    // 字体
    siteFont: s.siteFont || 'default',
    // 语言
    siteLanguage: ['zh-Hant', 'zh-Hans', 'en'].includes(s.siteLanguage) ? s.siteLanguage : 'zh-Hant',
    // 导航栏
    navItems: Array.isArray(s.navItems) ? s.navItems : null,
    // 相冊版面配置
    albumLayout: sanitizeAlbumLayout(s.albumLayout, DEFAULT_ALBUM_LAYOUT),
  });
});

app.get('/api/profile', (_req, res) => {
  res.json(readDb().profile);
});

app.get('/api/skills', (_req, res) => {
  res.json(readDb().skills);
});

app.get('/api/timeline', (_req, res) => {
  res.json(readDb().timeline);
});

app.get('/api/projects', (req, res) => {
  let list = [...readDb().projects];
  if (req.query.featured === '1' || req.query.featured === 'true') {
    list = list.filter((p) => p.featured);
  }
  res.json(list);
});

app.get('/api/projects/:id', (req, res) => {
  const project = readDb().projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  res.json(project);
});

// 友情链接（公开：仅展示中）
app.get('/api/friend-links', (req, res) => {
  res.json((readDb().friendLinks || []).filter((l) => l.visible !== false));
});

// 网址导航（公开：分类 + 站点卡片）
app.get('/api/nav-links', (_req, res) => {
  const db = readDb();
  const links = (db.navLinks || []).map((l, i) => ({
    id: l.id || `nl_${i}`,
    category: l.category,
    name: l.name,
    url: l.url,
    desc: l.desc || '',
    icon: l.icon || buildFaviconUrl(l.url),
    sort: l.sort ?? i,
  }));
  res.json({
    categories: db.navCategories || [],
    links,
  });
});

// 构建 favicon URL（运行时生成，不持久化）
function buildFaviconUrl(urlStr) {
  try {
    const host = new URL(urlStr).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return '';
  }
}

// 地图位置（公开：弹层展示用）
app.get('/api/map', (_req, res) => {
  const db = readDb();
  res.json(db.map || { lat: 32.060255, lng: 118.796877, name: '江苏 · 南京', address: '江苏省南京市', zoom: 12 });
});

// 友链申请（公开，写入待审核）
app.post('/api/friend-links/apply', (req, res) => {
  const body = req.body || {};
  if (body.website) return res.json({ ok: true, pending: true }); // honeypot：假装成功
  const name = String(body.name || '').trim().slice(0, 30);
  const url = String(body.url || '').trim().slice(0, 200);
  const desc = String(body.desc || '').trim().slice(0, 120);
  if (!name || !url) return res.status(400).json({ error: '请填写站点名称与网址' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: '网址需以 http(s):// 开头' });
  const db = readDb();
  db.friendLinks = db.friendLinks || [];
  if (db.friendLinks.some((l) => l.url === url)) return res.status(400).json({ error: '该网址已在友链名单中' });
  db.friendLinks.push({
    id: nextId('fl'),
    name,
    url,
    desc,
    visible: false,
    date: new Date().toISOString(),
  });
  saveDb(db);
  notifyFriendLinkApplied(db, { name, url, desc }).catch(() => {});
  res.json({ ok: true, pending: true });
});

/** 友链申请邮件通知：db.mailer 未配置时静默跳过 */
async function notifyFriendLinkApplied(db, { name, url, desc }) {
  const m = db.mailer;
  if (!m || !m.host || !m.to || !m.user || !m.pass) return;
  const transporter = nodemailer.createTransport({
    host: m.host,
    port: Number(m.port) || 465,
    secure: m.secure !== false,
    auth: { user: m.user, pass: m.pass },
  });
  await transporter.sendMail({
    from: m.from || m.user,
    to: m.to,
    subject: '【个人网站】新的友链申请',
    text: `站点名称：${name}\n网址：${url}\n简介：${desc || '（无）'}\n\n请在后台「友链」面板审核后展示。`,
  });
}

// 站点统计（文章数 / 总字数 / 运行时长基准 / 最近更新）
app.get('/api/stats', (req, res) => {
  const db = readDb();
  let words = 0;
  const count = (s) => {
    if (s) words += String(s).replace(/\s/g, '').length;
  };
  (db.posts || []).forEach((p) => {
    count(p.title);
    count(p.summary);
    (p.blocks || []).forEach((b) => {
      count(b.content);
      (b.items || []).forEach(count);
    });
  });
  (db.notes || []).forEach((n) => {
    count(n.title);
    count(n.content);
  });
  const dates = [...(db.posts || []), ...(db.notes || [])]
    .map((x) => x.date)
    .filter(Boolean)
    .sort();
  res.json({
    postCount: (db.posts || []).length + (db.notes || []).length,
    wordCount: words,
    startDate: db.siteStartDate || '2026-01-01',
    lastUpdate: dates.length ? String(dates[dates.length - 1]).slice(0, 10) : null,
  });
});

// 文章列表：支持 ?tag=xxx & ?category=blog|essay & ?limit=n，正文不返回（列表页更轻）
app.get('/api/posts', (req, res) => {
  const db = readDb();
  let list = [...db.posts];
  if (req.query.category) {
    list = list.filter((p) => (p.category || 'blog') === String(req.query.category));
  }
  if (req.query.tag) {
    list = list.filter((p) => p.tags.includes(String(req.query.tag)));
  }
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (req.query.limit) {
    list = list.slice(0, Number(req.query.limit));
  }
  res.json(list.map(({ blocks, ...rest }) => rest));
});

app.get('/api/posts/:id', (req, res) => {
  const post = readDb().posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '文章不存在' });
  res.json(post);
});

/* ---------------- 全站搜索（公開） ---------------- */
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const limit = Math.min(Number(req.query.limit) || 10, 30);
  const db = readDb();
  const results = [];
  const push = (type, item) => {
    results.push({ type, ...item });
  };
  // 博客
  for (const p of db.posts || []) {
    const hay = `${p.title} ${p.summary || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) push('blog', { id: p.id, title: p.title, summary: p.summary, to: `/blog/${p.id}`, tags: p.tags });
  }
  // 項目
  for (const p of db.projects || []) {
    const hay = `${p.title} ${p.desc || ''} ${(p.tags || []).join(' ')} ${(p.tech || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) push('project', { id: p.id, title: p.title, summary: p.desc, to: `/projects`, tags: p.tags });
  }
  // 隨筆
  for (const e of db.essays || []) {
    const hay = `${e.title} ${(e.content || '').slice(0, 200)}`.toLowerCase();
    if (hay.includes(q)) push('essay', { id: e.id, title: e.title, summary: (e.content || '').slice(0, 60), to: `/essay/${e.id}` });
  }
  // 圖文
  for (const n of (db.notes || []).filter((x) => x.visible !== false)) {
    const hay = `${n.title} ${(n.content || '').slice(0, 200)} ${(n.tags || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) push('note', { id: n.id, title: n.title, summary: (n.content || '').slice(0, 60), to: `/notes`, tags: n.tags });
  }
  // 留言板（搜名字和內容）
  for (const m of (db.messages || []).filter((x) => x.visible)) {
    const hay = `${m.name} ${m.content}`.toLowerCase();
    if (hay.includes(q)) push('message', { id: m.id, title: `留言 · ${m.name}`, summary: m.content.slice(0, 60), to: `/guestbook` });
  }
  // 輪播圖（搜標題）
  for (const b of (db.banners || []).filter((x) => x.visible !== false)) {
    const hay = `${b.title} ${b.subtitle || ''}`.toLowerCase();
    if (hay.includes(q)) push('banner', { id: b.id, title: b.title, summary: b.subtitle, to: b.to });
  }
  res.json(results.slice(0, limit));
});


/* ---------------- 相冊（公開） ---------------- */

/** 獲取相冊全局密碼：環境變量優先，其次 db.json，最後默認 1126 */
function getAlbumPassword() {
  if (process.env.ALBUM_PASSWORD) return process.env.ALBUM_PASSWORD;
  try {
    const db = readDb();
    if (db.albumPassword && typeof db.albumPassword === 'string') return db.albumPassword;
  } catch {}
  return '1126';
}

app.post('/api/album/verify', (req, res) => {
  const pwd = String(req.body?.password || '');
  if (safeEqualStr(pwd, getAlbumPassword())) {
    try {
      res.cookie('album_auth', crypto.randomBytes(16).toString('hex'), { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
    } catch {}
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '密碼錯誤' });
});

function isAlbumAuthed(req) {
  return req.cookies && req.cookies.album_auth;
}

/** 檢查某分類是否已通過密碼驗證（該分類有密碼保護時才需要） */
function isCategoryAuthed(req, catId) {
  // 如果全局驗證沒通過，直接失敗
  if (!isAlbumAuthed(req)) return false;
  try {
    const db = readDb();
    const cat = (db.albumCategories || []).find((c) => c.id === catId);
    // 如果該分類沒有密碼保護，只要全局驗證通過就算通過
    if (!cat || !cat.passwordHash) return true;
    // 有密碼保護，檢查對應 cookie
    const cookieName = `cat_auth_${catId}`;
    return req.cookies && req.cookies[cookieName];
  } catch {
    return false;
  }
}

/** 公開返回分類時，去掉敏感字段，只保留 hasPassword 標識；
 * 同時附帶該分類的照片數量；若分類沒有封面，自動取該分類第一張照片作為封面 */
function sanitizeCategoryForPublic(cat, db) {
  const { passwordHash, ...public } = cat;
  public.hasPassword = !!passwordHash;
  if (db) {
    const own = (db.albumPhotos || []).filter((p) => p.categoryId === cat.id);
    public.photoCount = own.length;
    // 沒有 cover 時自動取該分類的第一張照片
    if (!public.cover && own.length) {
      const firstPhoto = own.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))[0];
      if (firstPhoto) public.cover = firstPhoto.url;
    }
  }
  return public;
}

app.post('/api/album/categories/:id/verify', (req, res) => {
  if (!isAlbumAuthed(req)) return res.status(401).json({ error: '需要先驗證相冊全局密碼' });
  const cat = (readDb().albumCategories || []).find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  if (!cat.passwordHash) return res.json({ ok: true }); // 該分類無密碼保護
  const pwd = String(req.body?.password || '');
  if (safeEqualStr(pwd, cat.passwordHash)) {
    try {
      const cookieName = `cat_auth_${req.params.id}`;
      res.cookie(cookieName, crypto.randomBytes(16).toString('hex'), { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
    } catch {}
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '密碼錯誤' });
});

app.get('/api/album/categories', (_req, res) => {
  if (!isAlbumAuthed(_req)) return res.status(401).json({ error: '需要密碼' });
  const db = readDb();
  const cats = (db.albumCategories || []).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  res.json(cats.map((c) => sanitizeCategoryForPublic(c, db)));
});

app.get('/api/album/categories/:id', (req, res) => {
  if (!isCategoryAuthed(req, req.params.id)) {
    const db = readDb();
    const cat = (db.albumCategories || []).find((c) => c.id === req.params.id);
    if (cat && cat.passwordHash) return res.status(401).json({ error: '該分類需要密碼驗證' });
    return res.status(401).json({ error: '需要密碼' });
  }
  const db = readDb();
  const cat = (db.albumCategories || []).find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  res.json(sanitizeCategoryForPublic(cat, db));
});

app.get('/api/album/categories/:id/photos', (req, res) => {
  if (!isCategoryAuthed(req, req.params.id)) {
    const db = readDb();
    const cat = (db.albumCategories || []).find((c) => c.id === req.params.id);
    if (cat && cat.passwordHash) return res.status(401).json({ error: '該分類需要密碼驗證' });
    return res.status(401).json({ error: '需要密碼' });
  }
  const db = readDb();
  const photos = (db.albumPhotos || []).filter((p) => p.categoryId === req.params.id).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  res.json(photos);
});

/* ---------------- 相冊管理（admin） ---------------- */
app.get('/api/admin/album/categories', requireAdmin, (_req, res) => {
  // 管理端也不返回密碼哈希，只返回 hasPassword 標識
  const db = readDb();
  const cats = (db.albumCategories || []).map((c) => sanitizeCategoryForPublic(c, db));
  res.json(cats);
});

// 管理端直接讀取某分類所有照片（不需要密碼，僅需 admin token）
app.get('/api/admin/album/categories/:id/photos', requireAdmin, (req, res) => {
  const db = readDb();
  const photos = (db.albumPhotos || [])
    .filter((p) => p.categoryId === req.params.id)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  res.json(photos);
});

app.post('/api/admin/album/categories', requireAdmin, (req, res) => {
  const db = readDb();
  const cat = {
    id: nextId('AC'),
    title: String(req.body?.title || '未命名分類').slice(0, 40),
    cover: String(req.body?.cover || ''),
    desc: String(req.body?.desc || '').slice(0, 120),
    sort: Number(req.body?.sort) || 0,
  };
  // 處理可選密碼
  const rawPassword = String(req.body?.password || '').trim();
  const passwordConfirm = String(req.body?.passwordConfirm || '').trim();
  if (rawPassword) {
    if (rawPassword !== passwordConfirm) {
      return res.status(400).json({ error: '兩次輸入的密碼不一致' });
    }
    if (rawPassword.length < 4 || rawPassword.length > 64) {
      return res.status(400).json({ error: '密碼長度需在 4-64 位之間' });
    }
    cat.passwordHash = sha256(rawPassword);
  }
  db.albumCategories = db.albumCategories || [];
  db.albumCategories.push(cat);
  saveDb(db);
  res.status(201).json(sanitizeCategoryForPublic(cat, db));
});

app.put('/api/admin/album/categories/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.albumCategories = db.albumCategories || [];
  const idx = db.albumCategories.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '分類不存在' });

  const updateData = {
    ...db.albumCategories[idx],
  };
  if (req.body.title !== undefined) updateData.title = String(req.body.title).slice(0, 40);
  if (req.body.cover !== undefined) updateData.cover = String(req.body.cover);
  if (req.body.desc !== undefined) updateData.desc = String(req.body.desc).slice(0, 120);
  if (req.body.sort !== undefined) updateData.sort = Number(req.body.sort);

  // 處理密碼更新
  const rawPassword = String(req.body?.password || '').trim();
  const passwordConfirm = String(req.body?.passwordConfirm || '').trim();
  const clearPassword = Boolean(req.body?.clearPassword);

  if (clearPassword) {
    // 清除密碼保護
    delete updateData.passwordHash;
  } else if (rawPassword) {
    // 更新密碼
    if (rawPassword !== passwordConfirm) {
      return res.status(400).json({ error: '兩次輸入的密碼不一致' });
    }
    if (rawPassword.length < 4 || rawPassword.length > 64) {
      return res.status(400).json({ error: '密碼長度需在 4-64 位之間' });
    }
    updateData.passwordHash = sha256(rawPassword);
  }
  // 否則：不動原密碼

  db.albumCategories[idx] = updateData;
  saveDb(db);
  res.json(sanitizeCategoryForPublic(db.albumCategories[idx], db));
});

app.delete('/api/admin/album/categories/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.albumCategories = (db.albumCategories || []).filter((c) => c.id !== req.params.id);
  db.albumPhotos = (db.albumPhotos || []).filter((p) => p.categoryId !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

// 单张图片上传（通用，返回 /uploads/xxx 路径）
app.post('/api/admin/upload/image', requireAdmin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '图片不能超过 5MB' });
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) return res.status(400).json({ error: '请选择图片' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// 轮播图视频上传（独立 multer：mime + 大小规则与图片不同）
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB/个
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      cb(null, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 MP4 / WebM / MOV 视频'));
  },
});
app.post('/api/admin/upload/video', requireAdmin, (req, res) => {
  videoUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '视频不能超过 50MB' });
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) return res.status(400).json({ error: '请选择视频' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

app.post('/api/admin/album/upload', requireAdmin, (req, res) => {
  upload.array('images', 30)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '單張圖片不能超過 8MB' });
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '一次最多上傳 30 張' });
      return res.status(400).json({ error: err.message || '上傳失敗' });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: '請選擇圖片' });
    const categoryId = String(req.body.categoryId || '');
    const db = readDb();
    db.albumPhotos = db.albumPhotos || [];
    const photos = req.files.map((f, i) => ({
      id: nextId('AP'),
      categoryId,
      url: '/uploads/' + f.filename,
      caption: '',
      sort: Date.now() + i,
    }));
    db.albumPhotos.push(...photos);
    saveDb(db);
    res.status(201).json(photos);
  });
});

app.delete('/api/admin/album/photos/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const idx = (db.albumPhotos || []).findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '圖片不存在' });
  db.albumPhotos.splice(idx, 1);
  saveDb(db);
  res.json({ ok: true });
});

app.put('/api/admin/album/photos/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const p = (db.albumPhotos || []).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '圖片不存在' });
  if (req.body.caption !== undefined) p.caption = String(req.body.caption).slice(0, 80);
  if (req.body.sort !== undefined) p.sort = Number(req.body.sort);
  if (req.body.categoryId !== undefined) p.categoryId = String(req.body.categoryId);
  saveDb(db);
  res.json(p);
});

/* ---------------- 网址导航管理（admin 写） ---------------- */

// Admin 读：返回原始数据（带 id/sort 字段）
app.get('/api/admin/nav-links', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({
    categories: db.navCategories || [],
    links: db.navLinks || [],
  });
});

// Categories CRUD
app.post('/api/admin/nav-categories', requireAdmin, (req, res) => {
  const db = readDb();
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ code: 1, msg: '分类名不能为空' });
  if ((db.navCategories || []).includes(name)) return res.status(400).json({ code: 1, msg: '分类已存在' });
  db.navCategories = [...(db.navCategories || []), name];
  saveDb(db);
  res.json({ code: 0, data: db.navCategories });
});

app.put('/api/admin/nav-categories/:oldName', requireAdmin, (req, res) => {
  const db = readDb();
  const oldName = decodeURIComponent(req.params.oldName);
  const newName = (req.body.name || '').trim();
  if (!newName) return res.status(400).json({ code: 1, msg: '分类名不能为空' });
  const cats = db.navCategories || [];
  const idx = cats.indexOf(oldName);
  if (idx < 0) return res.status(404).json({ code: 1, msg: '分类不存在' });
  cats[idx] = newName;
  // 同步更新 links 里的 category
  db.navLinks = (db.navLinks || []).map((l) => (l.category === oldName ? { ...l, category: newName } : l));
  db.navCategories = cats;
  saveDb(db);
  res.json({ code: 0, data: { categories: db.navCategories, links: db.navLinks } });
});

app.delete('/api/admin/nav-categories/:name', requireAdmin, (req, res) => {
  const db = readDb();
  const name = decodeURIComponent(req.params.name);
  const cats = db.navCategories || [];
  if (!cats.includes(name)) return res.status(404).json({ code: 1, msg: '分类不存在' });
  db.navCategories = cats.filter((c) => c !== name);
  db.navLinks = (db.navLinks || []).filter((l) => l.category !== name);
  saveDb(db);
  res.json({ code: 0, data: { categories: db.navCategories, links: db.navLinks } });
});

// Links CRUD
app.post('/api/admin/nav-links', requireAdmin, (req, res) => {
  const db = readDb();
  const { category, name, url, desc, icon, sort } = req.body || {};
  if (!category || !name || !url) return res.status(400).json({ code: 1, msg: '分类/名称/URL 必填' });
  const id = `nl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const link = { id, category, name: name.trim(), url: url.trim(), desc: (desc || '').trim(), icon: icon || '', sort: sort ?? (db.navLinks?.length || 0) };
  db.navLinks = [...(db.navLinks || []), link];
  saveDb(db);
  res.json({ code: 0, data: link });
});

// 批量更新排序（拖拽后保存）- 必须在 :id 之前
app.put('/api/admin/nav-links/batch-reorder', requireAdmin, (req, res) => {
  const db = readDb();
  const { links } = req.body || {};
  if (!Array.isArray(links)) return res.status(400).json({ code: 1, msg: 'links 必须是数组' });
  const map = new Map(links.map((l) => [l.id, l]));
  db.navLinks = (db.navLinks || []).map((l) => {
    const upd = map.get(l.id);
    return upd ? { ...l, sort: upd.sort ?? l.sort, category: upd.category || l.category } : l;
  });
  saveDb(db);
  res.json({ code: 0 });
});

app.put('/api/admin/nav-links/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const links = db.navLinks || [];
  const idx = links.findIndex((l) => l.id === req.params.id);
  if (idx < 0) return res.status(404).json({ code: 1, msg: '链接不存在' });
  links[idx] = { ...links[idx], ...req.body };
  db.navLinks = links;
  saveDb(db);
  res.json({ code: 0, data: links[idx] });
});

app.delete('/api/admin/nav-links/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.navLinks = (db.navLinks || []).filter((l) => l.id !== req.params.id);
  saveDb(db);
  res.json({ code: 0 });
});


app.get('/api/messages', (_req, res) => {
  const list = readDb().messages.filter((m) => m.visible);
  res.json(list);
});

/* ---------------- 輪播圖（公開） ---------------- */
app.get('/api/banners', (_req, res) => {
  const list = (readDb().banners || [])
    .filter((b) => b.visible !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    // 補齊向前兼容的默認字段（舊 db 對象缺 showKind 等），不寫回磁盤
    .map((b) => ({
      ...b,
      showKind: b.showKind !== false,
      video: b.video || '',
    }));
  res.json(list);
});

/* ---------------- 图文笔记（公开只读 + 点赞） ---------------- */

// 图文列表：仅返回公开笔记，按时间倒序，支持 ?tag=xxx
app.get('/api/notes', (req, res) => {
  const db = readDb();
  let list = (db.notes || []).filter((n) => n.visible);
  if (req.query.tag) {
    list = list.filter((n) => (n.tags || []).includes(String(req.query.tag)));
  }
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json(list);
});

app.get('/api/notes/:id', (req, res) => {
  const note = (readDb().notes || []).find((n) => n.id === req.params.id && n.visible);
  if (!note) return res.status(404).json({ error: '笔记不存在' });
  res.json(note);
});

// 点赞 / 取消点赞（客户端去重，简单计数）
app.post('/api/notes/:id/like', (req, res) => {
  const db = readDb();
  const note = (db.notes || []).find((n) => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: '笔记不存在' });
  const action = req.body && req.body.action === 'unlike' ? 'unlike' : 'like';
  note.likes = Math.max(0, (note.likes || 0) + (action === 'like' ? 1 : -1));
  saveDb(db);
  res.json({ id: note.id, likes: note.likes });
});

/* ---------------- 笔记评论（公开只读 + 发表） ---------------- */

// 某篇笔记的可见评论（时间正序）
app.get('/api/notes/:id/comments', (req, res) => {
  const db = readDb();
  const note = (db.notes || []).find((n) => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: '笔记不存在' });
  const list = (db.comments || [])
    .filter((c) => c.noteId === req.params.id && c.visible)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  res.json(list);
});

// 发表评论：校验 + 敏感词打码 + honeypot
app.post('/api/notes/:id/comments', (req, res) => {
  const db = readDb();
  const note = (db.notes || []).find((n) => n.id === req.params.id && n.visible);
  if (!note) return res.status(404).json({ error: '笔记不存在' });

  const { name, content, website } = req.body || {};
  if (website) {
    return res.status(200).json({ id: 'spam', name: '', content: '', date: '' });
  }
  const err = validateMessage(name, content);
  if (err) return res.status(400).json({ error: err });

  if (!db.comments) db.comments = [];
  const comment = {
    id: nextId('cm'),
    noteId: req.params.id,
    name: String(name).trim().slice(0, 20),
    content: filterSensitive(String(content).trim()).slice(0, 300),
    date: new Date().toISOString(),
    visible: true,
  };
  db.comments.push(comment);
  saveDb(db);
  res.status(201).json(comment);
});

/* ---------------- 写入接口（UGC） ---------------- */

// 留言板：昵称 + 内容，敏感词打码，公开可见
app.post('/api/messages', (req, res) => {
  const { name, content, website } = req.body || {};
  // honeypot：隐藏字段被填了即判定为机器人，假装成功但不入库
  if (website) {
    return res.status(200).json({ id: 'spam', name: '', content: '', date: '' });
  }
  const err = validateMessage(name, content);
  if (err) return res.status(400).json({ error: err });

  const db = readDb();
  const message = {
    id: nextId('m'),
    name: String(name).trim().slice(0, 20),
    content: filterSensitive(String(content).trim()).slice(0, 500),
    date: new Date().toISOString().slice(0, 10),
    visible: true,
  };
  db.messages.unshift(message);
  saveDb(db);
  res.status(201).json(message);
});

// 联系表单：仅入库，不回显敏感信息；上线可接邮件服务（SMTP/Resend 等）
app.post('/api/contact', (req, res) => {
  const { name, email, message, website } = req.body || {};
  if (website) {
    return res.status(200).json({ ok: true });
  }
  const err = validateContact(name, email, message);
  if (err) return res.status(400).json({ error: err });

  const db = readDb();
  db.contactMessages.push({
    id: nextId('c'),
    name: String(name).trim().slice(0, 30),
    email: String(email).trim().slice(0, 100),
    message: filterSensitive(String(message).trim()).slice(0, 1000),
    date: new Date().toISOString(),
    read: false,
  });
  saveDb(db);
  res.status(201).json({ ok: true });
});

/* ================================================================
 * 后台管理 API（隐藏入口 /admin，token 鉴权）
 * 密码来源优先级：环境变量 ADMIN_PASSWORD > db.json.adminPassword > 默认 admin123
 * 修改密码接口会将新密码写入 db.json.adminPassword 持久化
 * ================================================================ */

const DEFAULT_ADMIN_PASSWORD = 'admin123';

/** 获取当前后台密码：环境变量优先，其次 db.json，最后默认值 */
function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  try {
    const db = readDb();
    if (db.adminPassword && typeof db.adminPassword === 'string') return db.adminPassword;
  } catch {
    /* db.json 读取失败时回退默认 */
  }
  return DEFAULT_ADMIN_PASSWORD;
}

if (!process.env.ADMIN_PASSWORD) {
  const dbPwd = (() => {
    try {
      const db = readDb();
      return db.adminPassword;
    } catch {
      return null;
    }
  })();
  if (!dbPwd) {
    console.warn('[warn] 未设置环境变量 ADMIN_PASSWORD 与 db.json.adminPassword，正在使用默认密码 admin123，请尽快修改！');
  }
}

/** 将新密码持久化到 db.json.adminPassword */
function persistAdminPassword(newPassword) {
  const db = readDb();
  db.adminPassword = newPassword;
  saveDb(db);
}

// 会话：内存缓存 + db.json 持久化（重启服务不失效），有效期 7 天
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const adminSessions = new Map();

/** 从 db.json 恢复持久化会话（启动时调用） */
function loadAdminSessions() {
  const db = readDb();
  const now = Date.now();
  const valid = (db.adminTokens || []).filter((t) => t && t.exp > now);
  if (valid.length !== (db.adminTokens || []).length) {
    db.adminTokens = valid;
    saveDb(db);
  }
  adminSessions.clear();
  for (const t of valid) adminSessions.set(t.token, t.exp);
}

loadAdminSessions();

/** 登录成功：写入内存 + 持久化（同时清理过期会话） */
function persistAdminSession(token, exp) {
  const db = readDb();
  db.adminTokens = (db.adminTokens || []).filter((t) => t && t.exp > Date.now());
  db.adminTokens.push({ token, exp });
  saveDb(db);
  adminSessions.set(token, exp);
}

/** 退出登录：内存 + 持久化同时移除 */
function removeAdminSession(token) {
  adminSessions.delete(token);
  const db = readDb();
  db.adminTokens = (db.adminTokens || []).filter((t) => t && t.token !== token);
  saveDb(db);
}

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function safeEqualStr(a, b) {
  const ba = Buffer.from(sha256(a));
  const bb = Buffer.from(sha256(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const exp = adminSessions.get(token);
  if (!exp) return res.status(401).json({ error: '未登录或登录已过期' });
  if (exp < Date.now()) {
    removeAdminSession(token);
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string' || !safeEqualStr(password, getAdminPassword())) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const exp = Date.now() + SESSION_TTL;
  persistAdminSession(token, exp);
  res.json({ token, expiresAt: new Date(exp).toISOString() });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  removeAdminSession(token);
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/me', (_req, res) => {
  res.json({ ok: true });
});

/* 修改后台密码：旧密码校验 + 新密码写入 db.json.adminPassword
 * 注意：若通过环境变量 ADMIN_PASSWORD 设密码，则不允许通过此接口修改（環境變量優先級最高） */
app.post('/api/admin/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || typeof oldPassword !== 'string') {
    return res.status(400).json({ error: '请输入旧密码' });
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: '请输入新密码' });
  }
  if (newPassword.length < 6 || newPassword.length > 64) {
    return res.status(400).json({ error: '新密码长度需在 6-64 位之间' });
  }
  if (process.env.ADMIN_PASSWORD) {
    return res.status(400).json({ error: '当前密码由环境变量 ADMIN_PASSWORD 设置，无法在此修改' });
  }
  if (!safeEqualStr(oldPassword, getAdminPassword())) {
    return res.status(401).json({ error: '旧密码错误' });
  }
  if (safeEqualStr(oldPassword, newPassword)) {
    return res.status(400).json({ error: '新密码不能与旧密码相同' });
  }
  persistAdminPassword(newPassword);
  res.json({ ok: true });
});

/* ---------- 站点设置 ---------- */

app.get('/api/admin/settings', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const s = readDb().settings || {};
  res.json({
    fancyButtons: !!s.fancyButtons,
    showCarousel: s.showCarousel !== false,
    carouselPaginate: s.carouselPaginate !== false,
    carouselInterval: s.carouselInterval || 5000,
    clickEffectEnabled: s.clickEffectEnabled !== false,
    clickEffect: s.clickEffect || 'hearts',
    customClickImage: s.customClickImage || '',
    clickEffectSize: typeof s.clickEffectSize === 'number' ? s.clickEffectSize : 1,
    clickEffectGlow: s.clickEffectGlow || 'soft',
    clickEffectGlowIntensity:
      typeof s.clickEffectGlowIntensity === 'number' ? s.clickEffectGlowIntensity : 60,
    clickEffectMulticolor: s.clickEffectMulticolor !== false,
    musicEnabled: s.musicEnabled !== false,
    musicSkin: s.musicSkin || 'default',
    musicSkinBg: s.musicSkinBg || '',
    musicSkinOpacity: typeof s.musicSkinOpacity === 'number' ? s.musicSkinOpacity : 85,
    musicSkinBlur: typeof s.musicSkinBlur === 'number' ? s.musicSkinBlur : 12,
    backgroundType: s.backgroundType || 'aurora',
    // 看板娘
    companionEnabled: s.companionEnabled !== false,
    companionSkin: s.companionSkin || 'default',
    companionIdleAnim: s.companionIdleAnim || 'bob',
    companionCustomImage: s.companionCustomImage || '',
    companionIdleAnimImage: s.companionIdleAnimImage || '',
    companionSays: Array.isArray(s.companionSays) ? s.companionSays : [],
    // 字体
    siteFont: s.siteFont || 'default',
    // 语言
    siteLanguage: ['zh-Hant', 'zh-Hans', 'en'].includes(s.siteLanguage) ? s.siteLanguage : 'zh-Hant',
    // 相冊版面配置
    albumLayout: sanitizeAlbumLayout(s.albumLayout, DEFAULT_ALBUM_LAYOUT),
  });
});

app.put('/api/admin/settings', (req, res) => {
  const body = req.body || {};
  const db = readDb();
  db.settings = db.settings || {};
  if (typeof body.fancyButtons === 'boolean') db.settings.fancyButtons = body.fancyButtons;
  if (typeof body.showCarousel === 'boolean') db.settings.showCarousel = body.showCarousel;
  if (typeof body.carouselPaginate === 'boolean') db.settings.carouselPaginate = body.carouselPaginate;
  if (typeof body.carouselInterval === 'number') db.settings.carouselInterval = Math.max(2000, Math.min(15000, body.carouselInterval));
  // 点击页面效果总开关
  if (typeof body.clickEffectEnabled === 'boolean') db.settings.clickEffectEnabled = body.clickEffectEnabled;
  if (typeof body.clickEffect === 'string' && ['hearts', 'burst', 'sparkle', 'custom'].includes(body.clickEffect)) {
    db.settings.clickEffect = body.clickEffect;
  }
  if (typeof body.customClickImage === 'string') db.settings.customClickImage = body.customClickImage.slice(0, 500000);
  // 点击粒子：大小倍率 / 发光样式 / 发光强度 / 是否多色
  // 越界值直接丢弃该字段（保留原值），不静默 clamp，避免前端与后端状态不一致
  if (typeof body.clickEffectSize === 'number' && isFinite(body.clickEffectSize)
      && body.clickEffectSize >= 0.4 && body.clickEffectSize <= 3) {
    db.settings.clickEffectSize = Math.round(body.clickEffectSize * 100) / 100;
  }
  const VALID_CLICK_GLOW = ['none', 'soft', 'strong', 'neon'];
  if (typeof body.clickEffectGlow === 'string' && VALID_CLICK_GLOW.includes(body.clickEffectGlow)) {
    db.settings.clickEffectGlow = body.clickEffectGlow;
  }
  if (typeof body.clickEffectGlowIntensity === 'number' && isFinite(body.clickEffectGlowIntensity)
      && body.clickEffectGlowIntensity >= 0 && body.clickEffectGlowIntensity <= 100) {
    db.settings.clickEffectGlowIntensity = Math.round(body.clickEffectGlowIntensity);
  }
  if (typeof body.clickEffectMulticolor === 'boolean') {
    db.settings.clickEffectMulticolor = body.clickEffectMulticolor;
  }
  if (typeof body.musicEnabled === 'boolean') db.settings.musicEnabled = body.musicEnabled;
  // 音乐播放器皮肤：内置若干套 + custom（上传图片）
  const VALID_MUSIC_SKIN = [
    'default',   // 跟随主题（毛玻璃）
    'light',     // 浅色纸感
    'dark',      // 深色午夜
    'glass',     // 通透玻璃
    'frosted',   // 磨砂白
    'midnight',  // 暗夜蓝紫
    'sunset',    // 暖阳渐变
    'neon',      // 霓虹暗色
    'paper',     // 米白素纸
    'custom',    // 自定义图片
  ];
  if (typeof body.musicSkin === 'string' && VALID_MUSIC_SKIN.includes(body.musicSkin)) {
    db.settings.musicSkin = body.musicSkin;
  }
  if (typeof body.musicSkinBg === 'string') db.settings.musicSkinBg = body.musicSkinBg.slice(0, 2000000);
  // 自定义皮肤的图层面板调节（透明度 0~100 / 模糊 0~40px）
  // 注意：数值越界时直接丢弃该字段（保留原值），而不是静默 clamp，
  // 否则「999」会被悄悄写成「100」，前端滑块与后端状态就不一致了。
  if (typeof body.musicSkinOpacity === 'number' && isFinite(body.musicSkinOpacity)
      && body.musicSkinOpacity >= 0 && body.musicSkinOpacity <= 100) {
    db.settings.musicSkinOpacity = Math.round(body.musicSkinOpacity);
  }
  if (typeof body.musicSkinBlur === 'number' && isFinite(body.musicSkinBlur)
      && body.musicSkinBlur >= 0 && body.musicSkinBlur <= 40) {
    db.settings.musicSkinBlur = Math.round(body.musicSkinBlur);
  }
  const VALID_BG = ['none','aurora','blackhole','bubbles','cosmic-portal','falling-stars','flickering-grid','interactive-grid','lamp','neural','pattern','ribbon','silk','snowfall','tetris','video-text','thunderstorm','wavy'];
  if (typeof body.backgroundType === 'string' && VALID_BG.includes(body.backgroundType)) {
    db.settings.backgroundType = body.backgroundType;
  }
  // 看板娘
  if (typeof body.companionEnabled === 'boolean') db.settings.companionEnabled = body.companionEnabled;
  const VALID_SKIN = ['default', 'cat', 'bunny', 'bear', 'panda', 'fox', 'avatar', 'custom'];
  if (typeof body.companionSkin === 'string' && VALID_SKIN.includes(body.companionSkin)) {
    db.settings.companionSkin = body.companionSkin;
  }
  const VALID_IDLE = ['bob', 'sway', 'breathe', 'none', 'custom'];
  if (typeof body.companionIdleAnim === 'string' && VALID_IDLE.includes(body.companionIdleAnim)) {
    db.settings.companionIdleAnim = body.companionIdleAnim;
  }
  if (typeof body.companionCustomImage === 'string') db.settings.companionCustomImage = body.companionCustomImage.slice(0, 500000);
  if (typeof body.companionIdleAnimImage === 'string') db.settings.companionIdleAnimImage = body.companionIdleAnimImage.slice(0, 2000000);
  if (Array.isArray(body.companionSays)) {
    db.settings.companionSays = body.companionSays
      .map((s) => String(s || '').trim())
      .filter((s) => s.length > 0)
      .slice(0, 30);
  }
  // 语言
  if (typeof body.siteLanguage === 'string' && ['zh-Hant', 'zh-Hans', 'en'].includes(body.siteLanguage)) {
    db.settings.siteLanguage = body.siteLanguage;
  }
  // 字体（白名单）
  const VALID_FONTS = [
    'default',
    'inter', 'system-ui', 'noto-sans-sc', 'roboto',
    'poppins', 'quicksand', 'nunito', 'open-sans',
    'montserrat', 'lora', 'playfair-display', 'source-sans-3',
    'jetbrains-mono',
  ];
  if (typeof body.siteFont === 'string' && VALID_FONTS.includes(body.siteFont)) {
    db.settings.siteFont = body.siteFont;
  }
  // 导航栏
  if (Array.isArray(body.navItems)) {
    db.settings.navItems = body.navItems
      .map((n) => ({
        to: String(n.to || '').trim().slice(0, 100),
        label: String(n.label || '').trim().slice(0, 10),
        icon: typeof n.icon === 'string' ? n.icon.trim().slice(0, 300) : '',
        hidden: n.hidden === true,
      }))
      .filter((n) => n.to && n.label)
      .slice(0, 30);
  }
  // 相冊版面配置
  if (body.albumLayout && typeof body.albumLayout === 'object') {
    db.settings.albumLayout = sanitizeAlbumLayout(
      body.albumLayout,
      db.settings.albumLayout || DEFAULT_ALBUM_LAYOUT,
    );
  }
  saveDb(db);
  res.json({ ok: true, settings: db.settings });
});

/* ---------- 文章管理 ---------- */

function sanitizePost(input, existing) {
  const base = existing || {};
  const title = input.title !== undefined ? String(input.title).trim() : base.title;
  if (!title) return { error: '标题不能为空' };
  const category = input.category !== undefined ? String(input.category) : base.category || 'blog';
  if (!['blog', 'essay'].includes(category)) return { error: '分类只能为 blog 或 essay' };
  return {
    post: {
      id: base.id,
      category,
      title: title.slice(0, 120),
      date: String(
        input.date !== undefined ? input.date : base.date || new Date().toISOString().slice(0, 10)
      ).slice(0, 10),
      tags: Array.isArray(input.tags)
        ? input.tags.map(String).slice(0, 8)
        : Array.isArray(base.tags)
          ? base.tags
          : [],
      summary: String(input.summary !== undefined ? input.summary : base.summary || '').slice(0, 300),
      readMinutes: Math.max(
        1,
        Math.min(120, Number(input.readMinutes !== undefined ? input.readMinutes : base.readMinutes) || 5)
      ),
      blocks: Array.isArray(input.blocks)
        ? input.blocks.slice(0, 300)
        : Array.isArray(base.blocks)
          ? base.blocks
          : [],
    },
  };
}

app.get('/api/admin/posts', (_req, res) => {
  res.json(readDb().posts);
});

app.post('/api/admin/posts', (req, res) => {
  const { post, error } = sanitizePost(req.body || {});
  if (error) return res.status(400).json({ error });
  const db = readDb();
  if (req.body.id && db.posts.some((x) => x.id === req.body.id)) {
    return res.status(409).json({ error: '该 id 已存在，请更换' });
  }
  post.id = req.body.id ? String(req.body.id).slice(0, 40) : nextId('p');
  db.posts.push(post);
  saveDb(db);
  res.status(201).json(post);
});

app.put('/api/admin/posts/:id', (req, res) => {
  const db = readDb();
  const idx = db.posts.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '文章不存在' });
  const { post, error } = sanitizePost(req.body || {}, db.posts[idx]);
  if (error) return res.status(400).json({ error });
  post.id = db.posts[idx].id;
  db.posts[idx] = post;
  saveDb(db);
  res.json(post);
});

app.delete('/api/admin/posts/:id', (req, res) => {
  const db = readDb();
  if (!db.posts.some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '文章不存在' });
  }
  db.posts = db.posts.filter((x) => x.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 项目管理 ---------- */

function sanitizeProject(input, existing) {
  const base = existing || {};
  const title = input.title !== undefined ? String(input.title).trim() : base.title;
  if (!title) return { error: '项目名称不能为空' };
  return {
    project: {
      id: base.id,
      title: title.slice(0, 60),
      desc: String(input.desc !== undefined ? input.desc : base.desc || '').slice(0, 300),
      tech: Array.isArray(input.tech)
        ? input.tech.map(String).slice(0, 10)
        : Array.isArray(base.tech)
          ? base.tech
          : [],
      tags: Array.isArray(input.tags)
        ? input.tags.map(String).slice(0, 6)
        : Array.isArray(base.tags)
          ? base.tags
          : [],
      repo: String(input.repo !== undefined ? input.repo : base.repo || '#').slice(0, 300),
      demo: String(input.demo !== undefined ? input.demo : base.demo || '#').slice(0, 300),
      featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(base.featured),
      gradient: String(input.gradient || base.gradient || 'linear-gradient(135deg,#06b6d4,#3b82f6)'),
      icon: String(input.icon || base.icon || 'code'),
    },
  };
}

app.get('/api/admin/projects', (_req, res) => {
  res.json(readDb().projects);
});

app.post('/api/admin/projects', (req, res) => {
  const { project, error } = sanitizeProject(req.body || {});
  if (error) return res.status(400).json({ error });
  const db = readDb();
  if (req.body.id && db.projects.some((x) => x.id === req.body.id)) {
    return res.status(409).json({ error: '该 id 已存在，请更换' });
  }
  project.id = req.body.id ? String(req.body.id).slice(0, 40) : nextId('pr');
  db.projects.push(project);
  saveDb(db);
  res.status(201).json(project);
});

app.put('/api/admin/projects/:id', (req, res) => {
  const db = readDb();
  const idx = db.projects.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '项目不存在' });
  const { project, error } = sanitizeProject(req.body || {}, db.projects[idx]);
  if (error) return res.status(400).json({ error });
  project.id = db.projects[idx].id;
  db.projects[idx] = project;
  saveDb(db);
  res.json(project);
});

app.delete('/api/admin/projects/:id', (req, res) => {
  const db = readDb();
  if (!db.projects.some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '项目不存在' });
  }
  db.projects = db.projects.filter((x) => x.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 友链管理 ---------- */

app.get('/api/admin/friend-links', (req, res) => {
  const list = [...(readDb().friendLinks || [])].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  );
  res.json(list);
});

app.post('/api/admin/friend-links', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 30);
  const url = String(body.url || '').trim().slice(0, 200);
  if (!name || !url) return res.status(400).json({ error: '请填写站点名称与网址' });
  const db = readDb();
  db.friendLinks = db.friendLinks || [];
  const item = {
    id: nextId('fl'),
    name,
    url,
    desc: String(body.desc || '').trim().slice(0, 120),
    visible: body.visible !== false,
    date: new Date().toISOString(),
  };
  db.friendLinks.push(item);
  saveDb(db);
  res.json(item);
});

app.patch('/api/admin/friend-links/:id', (req, res) => {
  const db = readDb();
  const item = (db.friendLinks || []).find((l) => l.id === req.params.id);
  if (!item) return res.status(404).json({ error: '友链不存在' });
  const body = req.body || {};
  if (body.name !== undefined) item.name = String(body.name).trim().slice(0, 30) || item.name;
  if (body.url !== undefined) item.url = String(body.url).trim().slice(0, 200) || item.url;
  if (body.desc !== undefined) item.desc = String(body.desc).trim().slice(0, 120);
  if (body.visible !== undefined) item.visible = !!body.visible;
  saveDb(db);
  res.json(item);
});

app.delete('/api/admin/friend-links/:id', (req, res) => {
  const db = readDb();
  db.friendLinks = (db.friendLinks || []).filter((l) => l.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 轮播图管理 ---------- */

function sanitizeBanner(input, existing) {
  const base = existing || {};
  // 标题允许为空（纯图片/视频轮播不需要文字）。空时降级到 ' '，方便后续 trim/slice。
  const title = input.title !== undefined ? String(input.title).trim() : (base.title || '');

  // 文字样式字段：每个字段都有兜底默认值
  const num = (v, d, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.max(min, Math.min(max, n));
  };
  const str = (v, d) => (v !== undefined && v !== null ? String(v) : d);

  return {
    banner: {
      id: base.id,
      title: title.slice(0, 80),
      subtitle: String(input.subtitle !== undefined ? input.subtitle : base.subtitle || '').slice(0, 200),
      desc: String(input.desc !== undefined ? input.desc : base.desc || '').slice(0, 300),
      to: String(input.to !== undefined ? input.to : base.to || '/').slice(0, 200),
      image: String(input.image !== undefined ? input.image : base.image || '').slice(0, 500),
      gradient: String(input.gradient !== undefined ? input.gradient : base.gradient || 'from-cyan-700 via-sky-800 to-blue-900').slice(0, 100),
      kind: ['blog', 'note', 'project', 'essay', 'custom'].includes(input.kind) ? input.kind : (base.kind || 'custom'),
      sort: num(input.sort !== undefined ? input.sort : base.sort, 0, 0, 999),
      visible: input.visible !== undefined ? Boolean(input.visible) : Boolean(base.visible !== false),

      // 文字显示开关
      showTitle: input.showTitle !== undefined ? Boolean(input.showTitle) : Boolean(base.showTitle !== false),
      showSubtitle: input.showSubtitle !== undefined ? Boolean(input.showSubtitle) : Boolean(base.showSubtitle !== false),
      showDesc: input.showDesc !== undefined ? Boolean(input.showDesc) : Boolean(base.showDesc !== false),

      // 主标题样式
      titleSize: num(input.titleSize !== undefined ? input.titleSize : base.titleSize, 48, 14, 120),
      titleWeight: ['normal', 'medium', 'semibold', 'bold', '900'].includes(input.titleWeight) ? input.titleWeight : (base.titleWeight || 'bold'),
      titleColor: str(input.titleColor !== undefined ? input.titleColor : base.titleColor, '#ffffff'),

      // 副标题样式
      subtitleSize: num(input.subtitleSize !== undefined ? input.subtitleSize : base.subtitleSize, 16, 12, 48),
      subtitleColor: str(input.subtitleColor !== undefined ? input.subtitleColor : base.subtitleColor, 'rgba(255,255,255,0.85)'),

      // 描述文字样式
      descSize: num(input.descSize !== undefined ? input.descSize : base.descSize, 14, 10, 36),
      descColor: str(input.descColor !== undefined ? input.descColor : base.descColor, 'rgba(255,255,255,0.75)'),

      // 位置控制
      textPosition: ['left', 'center', 'right'].includes(input.textPosition) ? input.textPosition : (base.textPosition || 'left'),
      textAlign: ['left', 'center', 'right'].includes(input.textAlign) ? input.textAlign : (base.textAlign || 'left'),
      textOffsetY: num(input.textOffsetY !== undefined ? input.textOffsetY : base.textOffsetY, 0, -30, 30),

      // 媒体扩展：可选的视频背景（mp4/webm/mov），存在时前台优先用视频做底图。
      video: String(input.video !== undefined ? input.video : base.video || '').slice(0, 500),
      // 是否显示左上角「博客 / 随笔 / ...」分类标签。默认 true（向前兼容旧数据）。
      showKind: input.showKind !== undefined ? Boolean(input.showKind) : (base.showKind === undefined ? true : base.showKind !== false),
    },
  };
}

app.get('/api/admin/banners', (_req, res) => {
  res.json(readDb().banners || []);
});

app.post('/api/admin/banners', (req, res) => {
  const { banner, error } = sanitizeBanner(req.body || {});
  if (error) return res.status(400).json({ error });
  const db = readDb();
  if (req.body.id && (db.banners || []).some((x) => x.id === req.body.id)) {
    return res.status(409).json({ error: '该 id 已存在，请更换' });
  }
  banner.id = req.body.id ? String(req.body.id).slice(0, 40) : nextId('b');
  if (!db.banners) db.banners = [];
  db.banners.push(banner);
  saveDb(db);
  res.status(201).json(banner);
});

app.put('/api/admin/banners/:id', (req, res) => {
  const db = readDb();
  const idx = (db.banners || []).findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '轮播项不存在' });
  const { banner, error } = sanitizeBanner(req.body || {}, db.banners[idx]);
  if (error) return res.status(400).json({ error });
  banner.id = db.banners[idx].id;
  db.banners[idx] = banner;
  saveDb(db);
  res.json(banner);
});

app.patch('/api/admin/banners/:id', (req, res) => {
  const db = readDb();
  const banner = (db.banners || []).find((x) => x.id === req.params.id);
  if (!banner) return res.status(404).json({ error: '轮播项不存在' });
  if (req.body.visible !== undefined) banner.visible = Boolean(req.body.visible);
  if (req.body.sort !== undefined) banner.sort = Math.max(0, Math.min(999, Number(req.body.sort) || 0));
  saveDb(db);
  res.json(banner);
});

app.delete('/api/admin/banners/:id', (req, res) => {
  const db = readDb();
  if (!(db.banners || []).some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '轮播项不存在' });
  }
  db.banners = db.banners.filter((x) => x.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 留言管理（隐藏/显示、删除） ---------- */

app.get('/api/admin/messages', (_req, res) => {
  res.json(readDb().messages);
});

app.patch('/api/admin/messages/:id', (req, res) => {
  const db = readDb();
  const msg = db.messages.find((x) => x.id === req.params.id);
  if (!msg) return res.status(404).json({ error: '留言不存在' });
  msg.visible = req.body.visible !== undefined ? Boolean(req.body.visible) : !msg.visible;
  saveDb(db);
  res.json(msg);
});

app.delete('/api/admin/messages/:id', (req, res) => {
  const db = readDb();
  if (!db.messages.some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '留言不存在' });
  }
  db.messages = db.messages.filter((x) => x.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 联系消息管理 ---------- */

app.get('/api/admin/contact-messages', (_req, res) => {
  res.json(readDb().contactMessages);
});

app.patch('/api/admin/contact-messages/:id', (req, res) => {
  const db = readDb();
  const msg = db.contactMessages.find((x) => x.id === req.params.id);
  if (!msg) return res.status(404).json({ error: '消息不存在' });
  msg.read = req.body.read !== undefined ? Boolean(req.body.read) : true;
  saveDb(db);
  res.json(msg);
});

app.delete('/api/admin/contact-messages/:id', (req, res) => {
  const db = readDb();
  if (!db.contactMessages.some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '消息不存在' });
  }
  db.contactMessages = db.contactMessages.filter((x) => x.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 资料 / 技能 / 时间线 ---------- */

const PROFILE_KEYS = [
  'name', 'title', 'location', 'email', 'avatarText', 'avatar',
  'tagline', 'bio', 'socials', 'stats', 'hobbies', 'info',
];

app.put('/api/admin/profile', (req, res) => {
  const db = readDb();
  const input = req.body || {};
  const next = { ...db.profile };
  for (const key of PROFILE_KEYS) {
    if (input[key] !== undefined) next[key] = input[key];
  }
  if (typeof next.name !== 'string' || !next.name.trim()) {
    return res.status(400).json({ error: '姓名不能为空' });
  }
  next.name = next.name.trim().slice(0, 30);
  next.title = String(next.title || '').slice(0, 40);
  next.location = String(next.location || '').slice(0, 60);
  next.email = String(next.email || '').slice(0, 120);
  if (typeof next.avatar === 'string') next.avatar = next.avatar.slice(0, 2000000);
  db.profile = next;
  saveDb(db);
  res.json(db.profile);
});

app.put('/api/admin/skills', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式错误：需要数组' });
  const db = readDb();
  db.skills = req.body.slice(0, 20);
  saveDb(db);
  res.json(db.skills);
});

app.put('/api/admin/timeline', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: '格式错误：需要数组' });
  const db = readDb();
  db.timeline = req.body.slice(0, 50);
  saveDb(db);
  res.json(db.timeline);
});

/* ---------- 图文笔记管理 ---------- */

// 上传图片（管理端）：multipart/form-data，字段名 images，最多 9 张
app.post('/api/admin/notes/upload', (req, res) => {
  upload.array('images', MAX_FILES)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '单张图片不能超过 8MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `一次最多上传 ${MAX_FILES} 张图片` });
      }
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: '请至少选择一张图片' });
    }
    res.status(201).json({
      urls: req.files.map((f) => `/uploads/${f.filename}`),
    });
  });
});

function sanitizeNote(input, existing) {
  const base = existing || {};
  const title = input.title !== undefined ? String(input.title).trim() : base.title;
  if (!title) return { error: '标题不能为空' };
  return {
    note: {
      id: base.id,
      title: title.slice(0, 60),
      content: String(input.content !== undefined ? input.content : base.content || '').slice(0, 1000),
      images: Array.isArray(input.images)
        ? input.images.map(String).slice(0, MAX_FILES)
        : Array.isArray(base.images)
          ? base.images.slice(0, MAX_FILES)
          : [],
      tags: Array.isArray(input.tags)
        ? input.tags.map(String).slice(0, 10)
        : Array.isArray(base.tags)
          ? base.tags
          : [],
      author: String(input.author !== undefined ? input.author : base.author || '林一舟').slice(0, 20),
      likes: Math.max(0, Number(input.likes !== undefined ? input.likes : base.likes) || 0),
      date: String(
        input.date !== undefined ? input.date : base.date || new Date().toISOString().slice(0, 10)
      ).slice(0, 10),
      visible: input.visible !== undefined ? Boolean(input.visible) : Boolean(base.visible !== false),
    },
  };
}

app.get('/api/admin/notes', (_req, res) => {
  res.json(readDb().notes || []);
});

app.post('/api/admin/notes', (req, res) => {
  const { note, error } = sanitizeNote(req.body || {});
  if (error) return res.status(400).json({ error });
  const db = readDb();
  if (req.body.id && (db.notes || []).some((x) => x.id === req.body.id)) {
    return res.status(409).json({ error: '该 id 已存在，请更换' });
  }
  note.id = req.body.id ? String(req.body.id).slice(0, 40) : nextId('n');
  if (!db.notes) db.notes = [];
  db.notes.push(note);
  saveDb(db);
  res.status(201).json(note);
});

app.put('/api/admin/notes/:id', (req, res) => {
  const db = readDb();
  const idx = (db.notes || []).findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '笔记不存在' });
  const { note, error } = sanitizeNote(req.body || {}, db.notes[idx]);
  if (error) return res.status(400).json({ error });
  note.id = db.notes[idx].id;
  db.notes[idx] = note;
  saveDb(db);
  res.json(note);
});

app.patch('/api/admin/notes/:id', (req, res) => {
  const db = readDb();
  const note = (db.notes || []).find((x) => x.id === req.params.id);
  if (!note) return res.status(404).json({ error: '笔记不存在' });
  if (req.body.visible !== undefined) note.visible = Boolean(req.body.visible);
  saveDb(db);
  res.json(note);
});

app.delete('/api/admin/notes/:id', (req, res) => {
  const db = readDb();
  if (!(db.notes || []).some((x) => x.id === req.params.id)) {
    return res.status(404).json({ error: '笔记不存在' });
  }
  db.notes = db.notes.filter((x) => x.id !== req.params.id);
  // 级联删除该笔记的评论
  if (db.comments) db.comments = db.comments.filter((c) => c.noteId !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------- 评论管理 ---------- */

app.get('/api/admin/comments', (req, res) => {
  const db = readDb();
  let list = [...(db.comments || [])];
  if (req.query.noteId) list = list.filter((c) => c.noteId === req.query.noteId);
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json(list);
});

app.patch('/api/admin/comments/:id', (req, res) => {
  const db = readDb();
  const comment = (db.comments || []).find((c) => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (req.body.visible !== undefined) comment.visible = Boolean(req.body.visible);
  saveDb(db);
  res.json(comment);
});

app.delete('/api/admin/comments/:id', (req, res) => {
  const db = readDb();
  if (!(db.comments || []).some((c) => c.id === req.params.id)) {
    return res.status(404).json({ error: '评论不存在' });
  }
  db.comments = db.comments.filter((c) => c.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* ---------------- 计划（Plan） ---------------- */

const PLAN_CATEGORIES = new Set(['travel', 'tech', 'game', 'health', 'life']);
const PLAN_SECTION_KINDS = new Set(['timeline', 'cards', 'budget', 'list', 'table', 'text']);
const DEFAULT_GRADIENT = 'from-cyan-600 via-sky-700 to-blue-800';

const pStr = (v, d = '', max = 500) => (v === undefined || v === null ? d : String(v).slice(0, max));
const pArr = (v) => (Array.isArray(v) ? v : []);

function sanitizePlanMeta(list) {
  return pArr(list)
    .slice(0, 6)
    .map((m) => ({ label: pStr(m && m.label, '', 20), value: pStr(m && m.value, '', 40) }))
    .filter((m) => m.label || m.value);
}

function sanitizePlanSection(s) {
  const src = s || {};
  const kind = PLAN_SECTION_KINDS.has(src.kind) ? src.kind : 'text';
  const out = { icon: pStr(src.icon, 'type', 40), title: pStr(src.title, '', 80), kind };
  if (src.desc) out.desc = pStr(src.desc, '', 500);

  if (kind === 'timeline') {
    out.nodes = pArr(src.nodes)
      .slice(0, 80)
      .map((n) => {
        const node = { badge: pStr(n && n.badge, '', 8), title: pStr(n && n.title, '', 140) };
        if (n && n.meta) node.meta = pStr(n.meta, '', 40);
        if (n && n.emoji) node.emoji = pStr(n.emoji, '', 8);
        if (n && pArr(n.tags).length) node.tags = pArr(n.tags).slice(0, 6).map((t) => pStr(t, '', 20));
        if (n && n.desc) node.desc = pStr(n.desc, '', 800);
        if (n && pArr(n.items).length) {
          node.items = pArr(n.items)
            .slice(0, 50)
            .map((i) => {
              const item = { label: pStr(i && i.label, '', 400) };
              if (i && i.time) item.time = pStr(i.time, '', 16);
              if (i && i.note) item.note = pStr(i.note, '', 200);
              return item;
            })
            .filter((i) => i.label);
        }
        if (n && pArr(n.footer).length) {
          node.footer = pArr(n.footer)
            .slice(0, 6)
            .map((f) => {
              const foot = {
                icon: pStr(f && f.icon, 'alert-circle', 40),
                label: pStr(f && f.label, '', 20),
                value: pStr(f && f.value, '', 300),
              };
              if (f && f.warn) foot.warn = true;
              return foot;
            })
            .filter((f) => f.value);
        }
        return node;
      })
      .filter((n) => n.title || n.items || n.desc);
  }

  if (kind === 'cards') {
    out.cards = pArr(src.cards)
      .slice(0, 40)
      .map((c) => {
        const card = { title: pStr(c && c.title, '', 80), desc: pStr(c && c.desc, '', 300) };
        if (c && c.emoji) card.emoji = pStr(c.emoji, '', 8);
        if (c && c.badge) card.badge = pStr(c.badge, '', 20);
        return card;
      })
      .filter((c) => c.title);
  }

  if (kind === 'budget') {
    out.budget = pArr(src.budget)
      .slice(0, 30)
      .map((b) => {
        const item = { label: pStr(b && b.label, '', 40), amount: pStr(b && b.amount, '', 24) };
        if (b && b.note) item.note = pStr(b.note, '', 160);
        return item;
      })
      .filter((b) => b.label);
  }

  if (kind === 'list') {
    out.list = pArr(src.list)
      .slice(0, 20)
      .map((g) => {
        const group = { items: pArr(g && g.items).slice(0, 40).map((i) => pStr(i, '', 500)).filter(Boolean) };
        if (g && g.icon) group.icon = pStr(g.icon, '', 8);
        if (g && g.title) group.title = pStr(g.title, '', 60);
        return group;
      })
      .filter((g) => g.items.length);
  }

  if (kind === 'table') {
    out.table = {
      headers: pArr(src.table && src.table.headers).slice(0, 8).map((h) => pStr(h, '', 30)),
      rows: pArr(src.table && src.table.rows)
        .slice(0, 80)
        .map((r) => pArr(r).slice(0, 8).map((c) => pStr(c, '', 240))),
    };
  }

  if (kind === 'text') out.text = pStr(src.text, '', 4000);

  return out;
}

/** 计划字段白名单 + 兜底默认值 */
function sanitizePlan(input, existing) {
  const base = existing || {};
  const pick = (k, d) => (input[k] !== undefined ? input[k] : base[k] !== undefined ? base[k] : d);

  const category = PLAN_CATEGORIES.has(pick('category', '')) ? pick('category', '') : 'life';
  const sortRaw = Number(pick('sort', 0));

  const plan = {
    id: base.id,
    title: pStr(pick('title', ''), '', 80),
    subtitle: pStr(pick('subtitle', ''), '', 140),
    category,
    emoji: pStr(pick('emoji', '📌'), '📌', 8),
    gradient: pStr(pick('gradient', DEFAULT_GRADIENT), DEFAULT_GRADIENT, 120),
    tags: pArr(pick('tags', []))
      .slice(0, 6)
      .map((t) => pStr(t, '', 20))
      .filter(Boolean),
    summary: pStr(pick('summary', ''), '', 500),
    meta: sanitizePlanMeta(pick('meta', [])),
    sections: pArr(pick('sections', [])).slice(0, 30).map(sanitizePlanSection),
    tips: pArr(pick('tips', []))
      .slice(0, 12)
      .map((g) => ({
        icon: pStr(g && g.icon, '📌', 8),
        title: pStr(g && g.title, '', 60),
        items: pArr(g && g.items).slice(0, 30).map((i) => pStr(i, '', 500)).filter(Boolean),
      }))
      .filter((g) => g.items.length),
    visible: pick('visible', true) !== false,
    sort: Number.isFinite(sortRaw) ? Math.max(0, Math.min(999, Math.trunc(sortRaw))) : 0,
    updatedAt: new Date().toISOString(),
  };

  const route = pArr(pick('route', []))
    .slice(0, 12)
    .map((r) => pStr(r, '', 20))
    .filter(Boolean);
  if (route.length) plan.route = route;

  return { plan };
}

/* 公开：只返回已发布的计划，按 sort 升序 */
app.get('/api/plans', (_req, res) => {
  const list = (readDb().plans || [])
    .filter((p) => p && p.visible !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  res.json(list);
});

/**
 * 计划库是否已初始化。
 * 前端据此决定：未初始化 → 先用内置数据兜底（并可引导去后台一键导入）；
 * 已初始化 → 完全以后台数据为准（后台把计划全隐藏时前台就该是空的）。
 */
app.get('/api/plans-seed-state', (_req, res) => {
  const db = readDb();
  res.json({ seeded: Array.isArray(db.plans), count: (db.plans || []).length });
});

app.get('/api/plans/:id', (req, res) => {
  const plan = (readDb().plans || []).find((p) => p.id === req.params.id);
  if (!plan || plan.visible === false) return res.status(404).json({ error: '计划不存在' });
  res.json(plan);
});

/* 后台：计划管理 */
app.get('/api/admin/plans', (_req, res) => {
  const list = [...(readDb().plans || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  res.json(list);
});

app.post('/api/admin/plans', (req, res) => {
  const body = req.body || {};
  const { plan } = sanitizePlan(body);
  if (!plan.title) return res.status(400).json({ error: '标题不能为空' });
  const db = readDb();
  if (!db.plans) db.plans = [];
  plan.id = body.id ? String(body.id).slice(0, 60) : nextId('p');
  if (db.plans.some((p) => p.id === plan.id)) {
    return res.status(409).json({ error: '该 id 已存在，请更换' });
  }
  if (body.sort === undefined) plan.sort = db.plans.length;
  db.plans.push(plan);
  saveDb(db);
  res.status(201).json(plan);
});

app.put('/api/admin/plans/:id', (req, res) => {
  const db = readDb();
  const idx = (db.plans || []).findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: '计划不存在' });
  const { plan } = sanitizePlan(req.body || {}, db.plans[idx]);
  if (!plan.title) return res.status(400).json({ error: '标题不能为空' });
  plan.id = db.plans[idx].id;
  db.plans[idx] = plan;
  saveDb(db);
  res.json(plan);
});

app.patch('/api/admin/plans/:id', (req, res) => {
  const db = readDb();
  const plan = (db.plans || []).find((p) => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  if (req.body.visible !== undefined) plan.visible = Boolean(req.body.visible);
  if (req.body.sort !== undefined) {
    plan.sort = Math.max(0, Math.min(999, Number(req.body.sort) || 0));
  }
  saveDb(db);
  res.json(plan);
});

app.delete('/api/admin/plans/:id', (req, res) => {
  const db = readDb();
  if (!(db.plans || []).some((p) => p.id === req.params.id)) {
    return res.status(404).json({ error: '计划不存在' });
  }
  db.plans = db.plans.filter((p) => p.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

/* 上传 md / html → 解析成计划草稿（不落库，交给前端预览确认） */
const DOC_EXT_RE = /\.(md|markdown|html?|txt)$/i;
const MAX_DOC_SIZE = 2 * 1024 * 1024; // 2MB
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE, files: 1 },
});

app.post('/api/admin/plans/parse', (req, res) => {
  docUpload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 2MB' : `上传失败：${err.message}`;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: '请选择要上传的文件' });
    const name = req.file.originalname || 'plan.md';
    if (!DOC_EXT_RE.test(name)) {
      return res.status(400).json({ error: '只支持 .md / .markdown / .html / .txt 文件' });
    }
    const raw = req.file.buffer.toString('utf-8');
    if (!raw.trim()) return res.status(400).json({ error: '文件内容为空' });
    try {
      const category = PLAN_CATEGORIES.has(req.body && req.body.category)
        ? req.body.category
        : undefined;
      const plan = parsePlanDocument(raw, name, { id: '', category });
      plan.id = '';
      res.json({ plan, filename: name, size: req.file.size });
    } catch (e) {
      res.status(500).json({ error: `解析失败：${e.message}` });
    }
  });
});

/* 一次性把前端内置计划导入数据库（首次启用后台管理时用） */
app.post('/api/admin/plans/import-builtin', (req, res) => {
  const incoming = Array.isArray(req.body && req.body.plans) ? req.body.plans : [];
  if (!incoming.length) return res.status(400).json({ error: '没有可导入的数据' });
  const db = readDb();
  if (!db.plans) db.plans = [];
  let added = 0;
  let skipped = 0;
  for (const raw of incoming) {
    const { plan } = sanitizePlan(raw || {});
    if (!plan.title) {
      skipped++;
      continue;
    }
    plan.id = raw && raw.id ? String(raw.id).slice(0, 60) : nextId('p');
    if (db.plans.some((p) => p.id === plan.id)) {
      skipped++;
      continue;
    }
    plan.visible = true;
    plan.sort = db.plans.length;
    db.plans.push(plan);
    added++;
  }
  saveDb(db);
  res.json({ ok: true, added, skipped, total: db.plans.length });
});

/* ---------------- 兜底 ---------------- */

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 统一错误处理（body-parser 解析错误 → 400，其余 → 500）
app.use((err, _req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error('[error]', err.message);
  res
    .status(status)
    .json({ error: status >= 500 ? '服务器内部错误' : '请求体格式有误' });
});


// 启动时自动给缺失 id 的 navLinks 补 id
const _startupDb = readDb();
let _fixedNavLinks = 0;
if (_startupDb.navLinks && _startupDb.navLinks.some((l) => !l.id)) {
  _startupDb.navLinks = _startupDb.navLinks.map((l) => {
    if (l.id) return l;
    _fixedNavLinks++;
    return { ...l, id: nextId('NL') };
  });
  saveDb(_startupDb);
  console.log(`[startup] 自动为 ${_fixedNavLinks} 条导航链接补齐 id`);
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`个人网站 API 服务已启动：http://localhost:${PORT}`);
  console.log(`数据文件：${require('./store').DB_FILE}`);
});
