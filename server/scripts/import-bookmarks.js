/**
 * 书签导入脚本：解析 Chrome Netscape Bookmark HTML → 合并到 db.json navLinks
 * 用法: node scripts/import-bookmarks.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BOOKMARKS_PATH = path.join(ROOT, '..', 'bookmarks_2026_9_9.html');
const DB_PATH = path.join(ROOT, 'data', 'db.json');

/* ====================== 1. 读取文件 ====================== */
if (!fs.existsSync(BOOKMARKS_PATH)) {
  console.error('❌ 找不到书签文件:', BOOKMARKS_PATH);
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 找不到 db.json:', DB_PATH);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const html = fs.readFileSync(BOOKMARKS_PATH, 'utf-8');

/* ====================== 2. 解析书签结构 ====================== */
// 书签树是嵌套 DL/DT/H3/A 的结构，用状态机遍历
function parseBookmarks(html) {
  const links = [];
  // 找到所有 <H3> 分类和 <A HREF=...> 链接，保留顺序
  const h3Regex = /<H3[^>]*>([^<]+)<\/H3>/gi;
  const aRegex = /<A\s+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;

  // 先收集所有 H3 的位置
  const h3s = [];
  let m;
  while ((m = h3Regex.exec(html)) !== null) {
    h3s.push({ name: m[1].trim(), index: m.index });
  }

  // 对每个 A 标签，找它前面最近的 H3 作为分类
  while ((m = aRegex.exec(html)) !== null) {
    const url = m[1].trim();
    const title = m[2].trim();
    const aIndex = m.index;

    // 过滤掉本地文件 / 扩展 / chrome 内部页
    if (
      url.startsWith('file://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('chrome://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://')
    ) continue;

    // 找这个 A 前面最近的 H3
    let category = h3s[0]?.name || '其他';
    for (const h of h3s) {
      if (h.index < aIndex) category = h.name;
      else break;
    }

    links.push({ url, title, srcCategory: category });
  }

  return links;
}

const rawLinks = parseBookmarks(html);
console.log(`📖 解析到 ${rawLinks.length} 个有效链接`);

/* ====================== 3. 书签分类 → 目标分类 映射 ====================== */
// db.json 现有分类: 前端开发 / 设计灵感 / 代码社区 / 效率工具 / 学习资源
// 书签里的分类（H3 文本）我做关键字映射，映射不上的进入"其他"

const TARGET_CATEGORIES = db.navCategories || [];

// 书签原始分类（从 H3 拿到的）→ 目标分类 精准映射
const EXACT_CATEGORY_MAP = {
  '冲浪前线': '代码社区',
  '视频娱乐': '视频娱乐',
  '其他娱乐': '视频娱乐',
  '前段基础': '前端开发',     // 用户打错字，应该是"前端"
  '前段组件': '前端开发',
  '前段拓展': '前端开发',
  '谷歌相关': '效率工具',
  '视频进阶': '视频娱乐',
  'work': '代码社区',
  '自我进阶': '学习资源',
  'vue相关': '前端开发',
  '游戏': '游戏',
  '书签栏': null,            // 根节点跳过
};

// 关键字兜底映射
const CATEGORY_KEYWORDS = [
  { target: '前端开发', keywords: ['前端', '组件', 'CSS', 'JS', 'Vue', 'React', 'TypeScript'] },
  { target: '代码社区', keywords: ['社区', '掘金', 'CSDN', '博客', '论坛', '知乎'] },
  { target: '设计灵感', keywords: ['设计', 'iconfont', '素材', 'Dribbble', 'Behance'] },
  { target: '效率工具', keywords: ['工具', '导航', '代理', 'VPN', '油猴', 'AI'] },
  { target: '学习资源', keywords: ['教程', '学习', '文档', '规范', 'API', '面试'] },
];

function mapCategory(link) {
  const src = link.srcCategory.trim();

  // ① 优先: 精准映射
  if (EXACT_CATEGORY_MAP[src] !== undefined) {
    return EXACT_CATEGORY_MAP[src] || '其他';
  }

  // ② 其次: 关键字匹配
  const srcLow = src.toLowerCase();
  const urlLow = link.url.toLowerCase();
  for (const rule of CATEGORY_KEYWORDS) {
    for (const kw of rule.keywords) {
      if (srcLow.includes(kw.toLowerCase()) || urlLow.includes(kw.toLowerCase())) {
        return rule.target;
      }
    }
  }

  // ③ 特殊域名
  if (/github\.com|gitee\.com/i.test(link.url)) return '代码社区';
  if (/bilibili|youtube|iqiyi|mgtv|youku|qq\.com\/video/i.test(link.url)) return '视频娱乐';
  if (/twitter|weibo|xiaohongshu|douyin/i.test(link.url)) return '社交媒体';

  return '其他';
}

// 收集需要新增的分类名（书签里的 H3 原始分类也保留下来）
const allCategories = new Set(TARGET_CATEGORIES);
rawLinks.forEach((l) => allCategories.add(mapCategory(l)));

/* ====================== 4. 构建新 navLinks（去重 + 合并） ====================== */
const existingUrls = new Set((db.navLinks || []).map((l) => l.url));

const descMap = {
  'cn.vuejs.org': '渐进式 JavaScript 框架',
  'react.dev': '用于构建用户界面的库',
};

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function guessDesc(url, title) {
  const d = extractDomain(url);
  if (descMap[d]) return descMap[d];
  // 去掉标题里的站点名后缀
  let desc = title
    .replace(/[-_|].*$/, '')
    .replace(/\s*[·—]\s*.+$/, '')
    .trim();
  if (desc.length > 30) desc = desc.slice(0, 30) + '…';
  return desc || '';
}

const newLinks = rawLinks
  .filter((l) => !existingUrls.has(l.url)) // 去重
  .map((l) => ({
    category: mapCategory(l),
    name: l.title.replace(/\s*\(.*?\)\s*/g, '').trim().slice(0, 40),
    url: l.url,
    desc: guessDesc(l.url, l.title),
  }));

console.log(`🆕 新链接: ${newLinks.length} 个（已过滤 ${rawLinks.length - newLinks.length} 个重复）`);

// 合并
const merged = [...(db.navLinks || []), ...newLinks];

/* ====================== 5. 写回 db.json ====================== */
db.navCategories = [...allCategories]; // 更新分类列表
db.navLinks = merged;

// 备份旧文件
const backupPath = DB_PATH + '.bak-' + Date.now();
fs.copyFileSync(DB_PATH, backupPath);

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

console.log(`✅ 导入完成！`);
console.log(`   navCategories: ${db.navCategories.length} 个分类`);
console.log(`   navLinks: ${db.navLinks.length} 个链接（原 ${(db.navLinks || []).length - newLinks.length} + 新增 ${newLinks.length}）`);
console.log(`   备份: ${backupPath}`);

// 打印分类统计
const byCat = {};
db.navLinks.forEach((l) => {
  byCat[l.category] = (byCat[l.category] || 0) + 1;
});
console.log(`\n📊 分类统计:`);
Object.entries(byCat)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, n]) => console.log(`   ${cat}: ${n}`));
