<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  adminLogin,
  adminMe,
  adminLogout,
  adminChangePassword,
  adminGetPosts,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
  adminGetProjects,
  adminCreateProject,
  adminUpdateProject,
  adminDeleteProject,
  adminGetMessages,
  adminToggleMessage,
  adminDeleteMessage,
  adminGetContacts,
  adminMarkContactRead,
  adminDeleteContact,
  adminGetNotes,
  adminToggleNote,
  adminDeleteNote,
  adminGetComments,
  adminToggleComment,
  adminDeleteComment,
  adminGetFriendLinks,
  adminCreateFriendLink,
  adminUpdateFriendLink,
  adminDeleteFriendLink,
  adminUpdateProfile,
  getProfile,
  setAdminToken,
  adminUploadImage,
  adminUploadBannerVideo,
  adminGetBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminPatchBanner,
  adminDeleteBanner,
  adminGetPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminPatchPlan,
  adminDeletePlan,
  adminParsePlanFile,
  adminImportBuiltinPlans,
  getPlansSeedState,
  type Banner,
} from '../api';
import type { Plan, PlanCategory, PlanSection, PlanSectionKind } from '../data/plans';
import { CATEGORY_EMOJI, CATEGORY_ORDER, plans as builtinPlans } from '../data/plans';
import type { Post, Project, Message, ContactMessage, Note, Comment, FriendLink, Profile } from '../types';
import type { AlbumCategory, AlbumPhoto } from '../api/album';
import type { AlbumLayout } from '../api';
import {
  adminGetAlbumCategories,
  adminCreateAlbumCategory,
  adminUpdateAlbumCategory,
  adminDeleteAlbumCategory,
  adminGetAlbumPhotos,
  adminUploadAlbumPhotos,
  adminDeleteAlbumPhoto,
  adminUpdateAlbumPhoto,
} from '../api/album';
import PostEditor from '../components/admin/PostEditor.vue';
import ProjectEditor from '../components/admin/ProjectEditor.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import ToggleSwitch from '../components/ui/ToggleSwitch.vue';
import NavManager from '../components/admin/NavManager.vue';
import { useSettings, DEFAULT_ALBUM_LAYOUT } from '../composables/useSettings';
import { useI18n, setLang, type SupportedLang } from '../composables/useI18n';
import { MUSIC_SKINS } from '../composables/useMusicSkin';
import { COMPANION_SKINS, getCompanionSkin } from '../composables/useCompanionSkin';
import { FONT_PRESETS } from '../composables/useFontLoader';
import { confirmNow } from '../composables/useConfirm';

type Tab = 'posts' | 'projects' | 'notes' | 'comments' | 'friendlinks' | 'messages' | 'contacts' | 'nav' | 'album' | 'profile' | 'navbar' | 'settings' | 'banners' | 'plans';

interface TabItem {
  key: Tab;
  label: string;
  icon: string;
  desc: string;
}

interface TabGroup {
  key: string;
  label: string;
  icon: string;
  desc: string;
  items: TabItem[];
}

/** 后台功能分组：分组直接决定左侧导航的结构，避免 12 个 tab 平铺挤压 */
const TAB_GROUPS: TabGroup[] = [
  {
    key: 'content',
    label: 'admin.group.content',
    icon: 'book',
    desc: 'admin.group.content',
    items: [
      { key: 'posts', label: 'admin.tab.posts', icon: 'book', desc: 'admin.tab.posts' },
      { key: 'projects', label: 'admin.tab.projects', icon: 'layers', desc: 'admin.tab.projects' },
      { key: 'notes', label: 'admin.tab.notes', icon: 'camera', desc: 'admin.tab.notes' },
      { key: 'album', label: 'admin.tab.album', icon: 'image', desc: 'admin.tab.album' },
      { key: 'plans', label: 'admin.tab.plans', icon: 'compass', desc: 'admin.tab.plans' },
      { key: 'banners', label: 'admin.tab.banners', icon: 'image', desc: 'admin.tab.banners' },
    ],
  },
  {
    key: 'interact',
    label: 'admin.group.interaction',
    icon: 'message',
    desc: 'admin.group.interaction',
    items: [
      { key: 'comments', label: 'admin.tab.comments', icon: 'message', desc: 'admin.tab.comments' },
      { key: 'messages', label: 'admin.tab.messages', icon: 'mail', desc: 'admin.tab.messages' },
      { key: 'friendlinks', label: 'admin.tab.friendlinks', icon: 'external', desc: 'admin.tab.friendlinks' },
      { key: 'contacts', label: 'admin.tab.contacts', icon: 'send', desc: 'admin.tab.contacts' },
    ],
  },
  {
    key: 'site',
    label: 'admin.group.site',
    icon: 'settings',
    desc: 'admin.group.site',
    items: [
      { key: 'nav', label: 'admin.tab.nav', icon: 'link', desc: 'admin.tab.nav' },
      { key: 'navbar', label: 'admin.tab.navbar', icon: 'menu', desc: 'admin.tab.navbar' },
      { key: 'profile', label: 'admin.tab.profile', icon: 'user', desc: 'admin.tab.profile' },
      { key: 'settings', label: 'admin.tab.settings', icon: 'settings', desc: 'admin.tab.settings' },
    ],
  },
];

/** 扁平化的 tab 清单（保留用于兼容旧引用，同时便于查找当前项） */
const TABS: TabItem[] = TAB_GROUPS.flatMap((g) => g.items);

/** 展开分组（受控，点击组头折叠/展开） */
const expandedGroups = ref<Record<string, boolean>>({
  content: true,
  interact: true,
  site: true,
});

/** 左栏是否收起（整体折叠，让内容区占满宽度） */
const sidebarCollapsed = ref(false);

/** 移动端是否展开左侧导航抽屉 */
const mobileNavOpen = ref(false);

const currentTabMeta = computed(() => TABS.find((t) => t.key === tab.value) ?? TABS[0]);

const route = useRoute();
const router = useRouter();

function isTabKey(v: unknown): v is Tab {
  return typeof v === 'string' && TABS.some((t) => t.key === v);
}

function selectTab(key: Tab) {
  tab.value = key;
  mobileNavOpen.value = false;
}

function toggleGroup(key: string) {
  expandedGroups.value[key] = !expandedGroups.value[key];
}

/** 当前 tab 所在分组，若被折叠则自动展开（保证选中项始终可见） */
function ensureGroupExpanded(key: Tab) {
  const g = TAB_GROUPS.find((grp) => grp.items.some((i) => i.key === key));
  if (g && !expandedGroups.value[g.key]) expandedGroups.value[g.key] = true;
}

const COLLAPSE_KEY = 'admin_sidebar_collapsed';

/** 切换页面时同步地址栏，便于分享/收藏具体页面（replace 避免污染历史） */
function syncTabToQuery(key: Tab) {
  const q = { ...route.query };
  if (key === 'posts') delete q.tab;
  else q.tab = key;
  router.replace({ query: q });
}

const checking = ref(true);
const loggedIn = ref(false);
const password = ref('');
const loginError = ref('');
const loginBusy = ref(false);

const tab = ref<Tab>('posts');
const loading = ref(false);
const posts = ref<Post[]>([]);
const postFilter = ref<'all' | 'blog' | 'essay'>('all');
const postFilters = ['all', 'blog', 'essay'] as const;
const filteredPosts = computed(() =>
  postFilter.value === 'all'
    ? posts.value
    : posts.value.filter((p) => (p.category ?? 'blog') === postFilter.value)
);
const projects = ref<Project[]>([]);
const messages = ref<Message[]>([]);
const contacts = ref<ContactMessage[]>([]);
const notes = ref<Note[]>([]);
const comments = ref<Comment[]>([]);
const friendLinks = ref<FriendLink[]>([]);
const friendForm = ref({ name: '', url: '', desc: '' });
const friendFormOpen = ref(false);
const friendEditingId = ref('');
const friendErr = ref('');

/* 轮播图管理 */
const banners = ref<Banner[]>([]);
const bannerFormOpen = ref(false);
const bannerEditingId = ref('');
const bannerForm = ref<Partial<Banner>>({});
const bannerErr = ref('');
const bannerLoading = ref(false);

/* 计划管理 */
const planItems = ref<Plan[]>([]);
const planSeeded = ref(false);
const planLoading = ref(false);
const planImporting = ref(false);
const planParsing = ref(false);
const planSaving = ref(false);
const planUploadName = ref('');
const planFileInput = ref<HTMLInputElement | null>(null);
const planFormOpen = ref(false);
const planEditingId = ref('');
const planForm = ref<Partial<Plan>>({});
const planErr = ref('');

const PLAN_GRADIENTS = [
  'from-cyan-600 via-sky-700 to-blue-800',
  'from-violet-600 via-indigo-700 to-blue-900',
  'from-rose-500 via-fuchsia-600 to-purple-800',
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-amber-500 via-orange-600 to-red-700',
  'from-slate-600 via-slate-700 to-slate-900',
];

/** 每个分类的默认封面渐变，切分类时自动跟随 */
const PLAN_CAT_GRADIENT: Record<PlanCategory, string> = {
  travel: 'from-cyan-600 via-sky-700 to-blue-800',
  tech: 'from-violet-600 via-indigo-700 to-blue-900',
  game: 'from-rose-500 via-fuchsia-600 to-purple-800',
  health: 'from-emerald-500 via-teal-600 to-cyan-700',
  life: 'from-amber-500 via-orange-600 to-red-700',
};

const PLAN_SECTION_LABELS: Record<PlanSectionKind, string> = {
  timeline: '时间线',
  cards: '卡片',
  budget: '预算',
  list: '清单',
  table: '表格',
  text: '文本',
};

const PLAN_CAT_LABELS: Record<PlanCategory, string> = {
  travel: '旅行',
  tech: '数码',
  game: '游戏',
  health: '健康',
  life: '生活',
};

/** 计划正文条目总数（列表卡片上展示） */
function planEntryCount(p: Plan): number {
  return p.sections.reduce((n, s) => {
    if (s.kind === 'timeline') return n + (s.nodes?.length ?? 0);
    if (s.kind === 'cards') return n + (s.cards?.length ?? 0);
    if (s.kind === 'budget') return n + (s.budget?.length ?? 0);
    if (s.kind === 'table') return n + (s.table?.rows.length ?? 0);
    if (s.kind === 'list') return n + (s.list ?? []).reduce((k, g) => k + g.items.length, 0);
    return n + (s.text ? 1 : 0);
  }, 0);
}

const planCatOptions = CATEGORY_ORDER;

/** 标签：输入框 ↔ 数组互转（用、或逗号分隔） */
const planTagsText = computed({
  get: () => (planForm.value.tags ?? []).join('、'),
  set: (v: string) => {
    planForm.value.tags = v
      .split(/[、,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  },
});

/** 路线：输入框 ↔ 数组互转（用 → 分隔） */
const planRouteText = computed({
  get: () => (planForm.value.route ?? []).join(' → '),
  set: (v: string) => {
    planForm.value.route = v
      .split(/[→,，]|\s*->\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  },
});

function defaultPlanForm(): Partial<Plan> {
  return {
    title: '',
    subtitle: '',
    category: 'life',
    emoji: '📌',
    gradient: PLAN_CAT_GRADIENT.life,
    tags: [],
    summary: '',
    meta: [],
    sections: [],
    tips: [],
    route: [],
    visible: true,
    sort: planItems.value.length,
  };
}

/** Section 结构摘要，用于编辑弹窗里的只读预览 */
function sectionSummary(s: PlanSection): string {
  switch (s.kind) {
    case 'timeline':
      return `${s.nodes?.length ?? 0} 个节点`;
    case 'cards':
      return `${s.cards?.length ?? 0} 张卡片`;
    case 'budget':
      return `${s.budget?.length ?? 0} 项预算`;
    case 'list':
      return `${(s.list ?? []).reduce((n, g) => n + g.items.length, 0)} 条`;
    case 'table':
      return `${s.table?.rows.length ?? 0} 行 × ${s.table?.headers.length ?? 0} 列`;
    case 'text':
      return `${(s.text ?? '').length} 字`;
    default:
      return '';
  }
}

function planSectionIcon(s: PlanSection): string {
  const map: Record<PlanSectionKind, string> = {
    timeline: 'calendar',
    cards: 'sparkle',
    budget: 'chart',
    list: 'check',
    table: 'grid',
    text: 'type',
  };
  return map[s.kind] ?? 'type';
}

function openPlanForm(p?: Plan) {
  planErr.value = '';
  planUploadName.value = '';
  if (p) {
    planEditingId.value = p.id;
    planForm.value = JSON.parse(JSON.stringify(p)) as Partial<Plan>;
  } else {
    planEditingId.value = '';
    planForm.value = defaultPlanForm();
  }
  planFormOpen.value = true;
}

function movePlanSection(i: number, dir: -1 | 1) {
  const list = planForm.value.sections;
  if (!list) return;
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  planForm.value.sections = next;
}

function removePlanSection(i: number) {
  planForm.value.sections = (planForm.value.sections ?? []).filter((_, idx) => idx !== i);
}

async function savePlan() {
  planErr.value = '';
  const f = planForm.value;
  if (!f.title || !String(f.title).trim()) {
    planErr.value = '标题不能为空';
    return;
  }
  planSaving.value = true;
  try {
    const payload: Partial<Plan> = {
      ...f,
      title: String(f.title).trim(),
      sections: f.sections ?? [],
      tips: f.tips ?? [],
      meta: (f.meta ?? []).filter((m) => m.label || m.value),
    };
    if (planEditingId.value) {
      await adminUpdatePlan(planEditingId.value, payload);
      showToast('已保存');
    } else {
      await adminCreatePlan(payload);
      showToast('已创建');
    }
    planFormOpen.value = false;
    await loadPlans();
  } catch (e) {
    planErr.value = errMsg(e, '保存失败');
  } finally {
    planSaving.value = false;
  }
}

async function removePlan(p: Plan) {
  if (!(await confirmNow({ title: '删除计划', message: `确定删除「${p.title}」？该操作不可撤销。`, danger: true }))) return;
  try {
    await adminDeletePlan(p.id);
    showToast('已删除');
    await loadPlans();
  } catch {
    showToast('删除失败');
  }
}

async function togglePlanVisible(p: Plan) {
  try {
    const updated = await adminPatchPlan(p.id, { visible: !p.visible });
    const i = planItems.value.findIndex((x) => x.id === p.id);
    if (i >= 0) planItems.value[i] = updated;
    showToast(updated.visible ? '已显示' : '已隐藏');
  } catch {
    showToast('操作失败');
  }
}

/** 上移 / 下移：与相邻计划交换 sort */
async function movePlan(p: Plan, dir: -1 | 1) {
  const sorted = [...planItems.value];
  const i = sorted.findIndex((x) => x.id === p.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  try {
    await Promise.all([
      adminPatchPlan(sorted[i]!.id, { sort: j }),
      adminPatchPlan(sorted[j]!.id, { sort: i }),
    ]);
    await loadPlans();
  } catch {
    showToast('排序失败');
  }
}

/** 选择 md / html → 后端解析 → 预填编辑弹窗 */
async function handlePlanUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  planParsing.value = true;
  try {
    const { plan } = await adminParsePlanFile(file);
    planForm.value = { ...defaultPlanForm(), ...plan, visible: true };
    planEditingId.value = '';
    planUploadName.value = file.name;
    planErr.value = '';
    planFormOpen.value = true;
    showToast(`已解析「${file.name}」，请确认后保存`);
  } catch (err) {
    showToast(errMsg(err, '解析失败'));
  } finally {
    planParsing.value = false;
  }
}

/** 把前端内置的 7 个计划一次性导入数据库 */
async function importBuiltinPlans() {
  if (
    !(await confirmNow({
      title: '导入内置计划',
      message: `将把内置的 ${builtinPlans.length} 个计划写入数据库，之后即可在后台管理。已存在的同名 id 会被跳过。`,
    }))
  )
    return;
  planImporting.value = true;
  try {
    const r = await adminImportBuiltinPlans(builtinPlans);
    showToast(`导入完成：新增 ${r.added} 个，跳过 ${r.skipped} 个`);
    await loadPlans();
  } catch (e) {
    showToast(errMsg(e, '导入失败'));
  } finally {
    planImporting.value = false;
  }
}

/** 下载一份能被完整解析的 Markdown 模板 */
function downloadPlanTemplate() {
  const tpl = `# 计划标题（写在这里）

一句话副标题，说明这个计划是做什么的。

## 关键信息

| 项目 | 内容 |
| --- | --- |
| 时间 | 10.1 – 10.6 |
| 预算 | ¥3,000 |
| 人数 | 2 人 |

## 亮点速览

- 🎯 **亮点一**：这里写具体描述
- 🌊 **亮点二**：这里写具体描述
- 🍜 **亮点三**：这里写具体描述

## 详细步骤

### 第一步 · 标题

这一步的说明文字。

- 09:00 具体要做的事情
- 12:00 具体要做的事情

### 第二步 · 标题

这一步的说明文字。

- 具体要做的事情

## 预算明细

- 交通 ¥800
- 住宿 ¥1,200
- 餐饮 ¥600

## 注意事项

- 这里写提醒
- 这里写提醒

<!--
写法说明（保存前可删除本段）：
  # 一级标题        → 计划标题
  ## 二级标题       → 页面上的一个区块
  ### 三级标题      → 时间线上的一个节点（如每一天 / 每道菜）
  | 表格 |          → 渲染成表格
  - 列表            → 渲染成清单 / 卡片
  预算小节含金额     → 自动渲染成预算进度条
  「注意事项」小节   → 自动归到页面底部的要点提醒
-->
`;
  const blob = new Blob([tpl], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '计划模板.md';
  a.click();
  URL.revokeObjectURL(url);
}

function defaultBannerForm(): Partial<Banner> {
  return {
    title: '',
    subtitle: '',
    desc: '',
    to: '/',
    image: '',
    video: '',
    gradient: 'from-cyan-700 via-sky-800 to-blue-900',
    kind: 'custom',
    sort: 0,
    visible: true,
    showKind: true,
    showTitle: true,
    showSubtitle: true,
    showDesc: false,
    titleSize: 48,
    titleWeight: 'bold',
    titleColor: '#ffffff',
    subtitleSize: 16,
    subtitleColor: 'rgba(255,255,255,0.85)',
    descSize: 14,
    descColor: 'rgba(255,255,255,0.75)',
    textPosition: 'left',
    textAlign: 'left',
    textOffsetY: 0,
  };
}

function openBannerForm(b?: Banner) {
  bannerErr.value = '';
  if (b) {
    bannerEditingId.value = b.id;
    bannerForm.value = { ...b };
  } else {
    bannerEditingId.value = '';
    bannerForm.value = defaultBannerForm();
  }
  bannerFormOpen.value = true;
}

async function saveBanner() {
  bannerErr.value = '';
  // 标题允许为空（纯图/视频轮播场景）；副标题/描述同样可空。
  bannerLoading.value = true;
  try {
    if (bannerEditingId.value) {
      await adminUpdateBanner(bannerEditingId.value, bannerForm.value);
    } else {
      await adminCreateBanner(bannerForm.value);
    }
    bannerFormOpen.value = false;
    await loadAll();
    showToast('已保存');
  } catch (e: any) {
    bannerErr.value = e?.response?.data?.error || '保存失败';
  } finally {
    bannerLoading.value = false;
  }
}

async function toggleBannerVisible(b: Banner) {
  try {
    await adminPatchBanner(b.id, { visible: !b.visible });
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeBanner(b: Banner) {
  if (!(await confirmNow({ title: '删除轮播项', message: `确定删除「${b.title}」？`, danger: true }))) return;
  try {
    await adminDeleteBanner(b.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

async function handleBannerImageUpload(file: File) {
  try {
    const { url } = await adminUploadImage(file);
    bannerForm.value.image = url;
  } catch {
    showToast('上传失败');
  }
}

/** 上传轮播背景视频（mp4/webm/mov，≤50MB）。存在视频时前台优先用视频做底图。 */
const bannerVideoUploading = ref(false);
async function handleBannerVideoUpload(file: File) {
  if (bannerVideoUploading.value) return;
  bannerVideoUploading.value = true;
  try {
    const { url } = await adminUploadBannerVideo(file);
    bannerForm.value.video = url;
    showToast('视频上传成功');
  } catch (e: any) {
    showToast(e?.response?.data?.error || '视频上传失败');
  } finally {
    bannerVideoUploading.value = false;
  }
}

/* 相册管理 */
const albumCategories = ref<AlbumCategory[]>([]);
const albumPhotos = ref<AlbumPhoto[]>([]);
const albumEditingCat = ref<AlbumCategory | null>(null);
const albumFormOpen = ref(false);
const albumForm = ref({ title: '', cover: '', desc: '', sort: 0, password: '', passwordConfirm: '', clearPassword: false });
const albumUploading = ref(false);
const albumDragActive = ref(false);
const albumUploadCatId = ref('');
const albumCurrentCat = ref<AlbumCategory | null>(null);
const albumPhotoFormOpen = ref(false);
const albumPhotoForm = ref<{ id: string; caption: string; categoryId: string; sort: number }>({ id: '', caption: '', categoryId: '', sort: 0 });
const profile = ref<Profile | null>(null);

/* ---------------- i18n ---------------- */
const { $t } = useI18n();

/* ---------------- 站点设置 ---------------- */
const { fancyButtons, showCarousel, carouselPaginate, carouselInterval, clickEffectEnabled, clickEffect, customClickImage, clickEffectSize, clickEffectGlow, clickEffectGlowIntensity, clickEffectMulticolor, musicEnabled, musicSkin, musicSkinBg, musicSkinOpacity, musicSkinBlur, backgroundType, companionEnabled, companionSkin, companionIdleAnim, companionIdleAnimImage, companionCustomImage, companionSays, siteFont, siteLanguage, navItems, albumLayout, updateSettings } = useSettings();

/* 导航栏配置 */
interface NavEditItem { to: string; label: string; icon: string; hidden?: boolean }
const navDraft = ref<NavEditItem[]>([]);
const navDraftLoaded = ref(false);
function loadNavDraft() {
  navDraft.value = navItems.value.map((n) => ({ ...n, icon: (n as any).icon || '' }));
  navDraftLoaded.value = true;
}
function navMove(from: number, dir: -1 | 1) {
  const to = from + dir;
  if (to < 0 || to >= navDraft.value.length) return;
  const arr = navDraft.value;
  [arr[from], arr[to]] = [arr[to], arr[from]];
  navDraft.value = [...arr];
}
function navAdd() { navDraft.value.push({ to: '/', label: '', icon: '' }); }
function navRemove(i: number) { navDraft.value.splice(i, 1); }
async function handleNavIconUpload(i: number, file?: File) {
  if (!file) return;
  try {
    const { url } = await adminUploadImage(file);
    navDraft.value[i].icon = url;
  } catch { showToast('上传失败'); }
}
async function saveNavDraft() {
  const cleaned = navDraft.value
    .map((n) => ({ to: n.to.trim(), label: n.label.trim(), icon: n.icon?.trim() || '', hidden: !!n.hidden }))
    .filter((n) => n.to && n.label)
    .slice(0, 30);
  if (!cleaned.length) { showToast('至少保留一项'); return; }
  try {
    await updateSettings({ navItems: cleaned });
    showToast('导航栏已更新，刷新前台即可看到效果');
  } catch { showToast('保存失败'); }
}

/* 切到导航栏 tab 时加载草稿 */
watch(tab, (t) => {
  if (t === 'navbar' && !navDraftLoaded.value) loadNavDraft();
});
const settingsSaving = ref(false);
async function toggleSetting(key: 'fancyButtons' | 'showCarousel' | 'carouselPaginate' | 'musicEnabled') {
  const map: Record<string, boolean> = {
    fancyButtons: fancyButtons.value,
    showCarousel: showCarousel.value,
    carouselPaginate: carouselPaginate.value,
    musicEnabled: musicEnabled.value,
  };
  const value = !map[key];
  settingsSaving.value = true;
  try {
    await updateSettings({ [key]: value });
    showToast('设置已更新');
  } catch (e) {
    if (is401(e)) { loggedIn.value = false; return; }
    showToast('设置保存失败');
  } finally { settingsSaving.value = false; }
}

/* 語言切換 */
const languageOptions = [
  { key: 'zh-Hant' as SupportedLang, label: '繁體中文', flag: '🇹🇼' },
  { key: 'zh-Hans' as SupportedLang, label: '简体中文', flag: '🇨🇳' },
  { key: 'en' as SupportedLang, label: 'English', flag: '🇺🇸' },
];
async function changeLanguage(lang: SupportedLang) {
  settingsSaving.value = true;
  try {
    await updateSettings({ siteLanguage: lang });
    setLang(lang);
    showToast('語言已切換');
  } catch (e) {
    if (is401(e)) { loggedIn.value = false; return; }
    showToast('語言切換失敗');
  } finally { settingsSaving.value = false; }
}

const CLICK_EFFECT_OPTIONS = [
  { value: 'hearts', label: '爱心', icon: 'heart', desc: '柔和飘心' },
  { value: 'burst', label: '炸开圆点', icon: 'circle', desc: '四散弹开' },
  { value: 'sparkle', label: '星星', icon: 'star', desc: '向上迸射' },
  { value: 'custom', label: '自定义图片', icon: 'image', desc: '上传图案' },
] as const;

/** 发光样式预设 */
const GLOW_OPTIONS = [
  { value: 'none', label: '无发光', desc: '纯色扁平，性能最好' },
  { value: 'soft', label: '柔和余光', desc: '淡淡一层光晕，日常推荐' },
  { value: 'strong', label: '强光', desc: '明显光晕，夜里醒目' },
  { value: 'neon', label: '霓虹描边', desc: '描边 + 外发光，赛博感' },
] as const;

async function setClickEffect(effect: 'hearts' | 'burst' | 'sparkle' | 'custom') {
  settingsSaving.value = true;
  try {
    const payload: Record<string, unknown> = { clickEffect: effect };
    if (effect !== 'custom') payload.customClickImage = '';
    await updateSettings(payload as any);
    showToast('点击效果已更新');
  } catch (e) {
    if (is401(e)) { loggedIn.value = false; return; }
    showToast('设置保存失败');
  } finally { settingsSaving.value = false; }
}

/** 点击效果参数的统一保存入口（避免每个滑块写一遍 try/catch） */
async function saveClickOption(payload: Record<string, unknown>, tip = '点击效果已更新') {
  settingsSaving.value = true;
  try {
    await updateSettings(payload as any);
    showToast(tip);
  } catch (e) {
    if (is401(e)) { loggedIn.value = false; return; }
    showToast('设置保存失败');
  } finally { settingsSaving.value = false; }
}

/** 点击效果总开关：与音乐/看板娘开关同一套写法 */
async function toggleClickEffect(next: boolean) {
  settingsSaving.value = true;
  try {
    await updateSettings({ clickEffectEnabled: next } as any);
    showToast(next ? '点击效果已开启' : '点击效果已关闭');
  } catch (e) {
    if (is401(e)) { loggedIn.value = false; return; }
    showToast('设置保存失败');
  } finally { settingsSaving.value = false; }
}

async function handleClickImageUpload(file: File) {
  if (!file.type.startsWith('image/')) { showToast('请上传图片文件'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    settingsSaving.value = true;
    try {
      await updateSettings({ customClickImage: reader.result as string, clickEffect: 'custom' });
      showToast('自定义图片已设置');
    } catch (e) {
      if (is401(e)) { loggedIn.value = false; return; }
      showToast('上传失败');
    } finally { settingsSaving.value = false; }
  };
  reader.readAsDataURL(file);
}

/* ---------- 看板娘设置 helpers ---------- */
async function handleCompanionImageUpload(file: File) {
  if (!file.type.startsWith('image/')) { showToast('請上傳圖片文件'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('圖片不能超過 2MB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await updateSettings({ companionCustomImage: reader.result as string, companionSkin: 'custom' });
      showToast('自定義看板娘已更新');
    } catch {
      showToast('上傳失敗');
    }
  };
  reader.readAsDataURL(file);
}
async function clearCompanionImage() {
  try {
    await updateSettings({ companionCustomImage: '', companionSkin: 'default' });
    showToast('已恢復預設造型');
  } catch { showToast('操作失敗'); }
}
async function handleCompanionIdleImageUpload(file: File) {
  if (!file.type.startsWith('image/')) { showToast('請上傳圖片文件'); return; }
  if (file.size > 8 * 1024 * 1024) { showToast('動圖不能超過 8MB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await updateSettings({ companionIdleAnimImage: reader.result as string, companionIdleAnim: 'custom' });
      showToast('自定義待機動圖已設置');
    } catch { showToast('上傳失敗'); }
  };
  reader.readAsDataURL(file);
}
async function clearCompanionIdleImage() {
  try {
    await updateSettings({ companionIdleAnimImage: '', companionIdleAnim: 'bob' });
    showToast('已恢復預設待機動畫');
  } catch { showToast('操作失敗'); }
}
async function saveCompanionSays(input: HTMLTextAreaElement) {
  const arr = input.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  if (arr.length > 30) { showToast('最多 30 條'); return; }
  try {
    await updateSettings({ companionSays: arr });
    showToast('語氣泡已保存');
  } catch { showToast('保存失敗'); }
}

const toast = ref('');
const postEditor = ref<{ open: boolean; post: Post | null }>({ open: false, post: null });
const projectEditor = ref<{ open: boolean; project: Project | null }>({ open: false, project: null });

function showToast(msg: string) {
  toast.value = msg;
  window.setTimeout(() => (toast.value = ''), 2600);
}

/* ---------------- 相冊版面配置（後台可調） ---------------- */

/** 相冊牆擺放風格 */
const WALL_LAYOUT_OPTIONS: { value: AlbumLayout['wall']['layout']; label: string; desc: string }[] = [
  { value: 'grid', label: '整齊網格', desc: '等高卡片整齊對齊，最規整' },
  { value: 'masonry', label: '瀑布流', desc: '卡片高度隨封面比例變化，錯落自然' },
  { value: 'tilt', label: '錯落貼牆', desc: '網格基礎上加輕微旋轉，像貼在牆上' },
];

/** 相冊內照片擺放風格 */
const PHOTO_LAYOUT_OPTIONS: { value: AlbumLayout['photos']['layout']; label: string; desc: string }[] = [
  { value: 'masonry', label: '瀑布流', desc: '保留原圖比例，錯落排布' },
  { value: 'grid', label: '等寬網格', desc: '等寬排列，可統一裁剪比例' },
];

const WALL_COL_OPTIONS: { value: AlbumLayout['wall']['columns']; label: string }[] = [
  { value: 'auto', label: '自適應' },
  { value: 2, label: '2 列' },
  { value: 3, label: '3 列' },
  { value: 4, label: '4 列' },
  { value: 5, label: '5 列' },
];

const PHOTO_COL_OPTIONS: { value: AlbumLayout['photos']['columns']; label: string }[] = [
  { value: 'auto', label: '自適應' },
  { value: 2, label: '2 列' },
  { value: 3, label: '3 列' },
  { value: 4, label: '4 列' },
  { value: 5, label: '5 列' },
  { value: 6, label: '6 列' },
];

const WALL_SIZE_OPTIONS: { value: AlbumLayout['wall']['size']; label: string }[] = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
];

const PHOTO_GAP_OPTIONS: { value: AlbumLayout['photos']['gap']; label: string }[] = [
  { value: 'sm', label: '緊湊' },
  { value: 'md', label: '適中' },
  { value: 'lg', label: '寬鬆' },
];

const PHOTO_RATIO_OPTIONS: { value: AlbumLayout['photos']['ratio']; label: string }[] = [
  { value: 'original', label: '原始比例' },
  { value: 'square', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
];

/** 分段按鈕的選中 / 未選中樣式 */
function segClass(active: boolean) {
  return active
    ? 'border-transparent text-white shadow-sm'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300';
}
function segStyle(active: boolean) {
  return active ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' } : undefined;
}

/** 表單副本：改動先存本地，點「保存配置」才寫回後台 */
const albumLayoutForm = ref<AlbumLayout>({
  wall: { ...DEFAULT_ALBUM_LAYOUT.wall },
  photos: { ...DEFAULT_ALBUM_LAYOUT.photos },
});

// 設定載入或保存後同步到表單
watch(
  () => albumLayout.value,
  (v) => {
    albumLayoutForm.value = { wall: { ...v.wall }, photos: { ...v.photos } };
  },
  { immediate: true },
);

const albumLayoutSaving = ref(false);

async function saveAlbumLayout() {
  if (albumLayoutSaving.value) return;
  albumLayoutSaving.value = true;
  try {
    await updateSettings({ albumLayout: albumLayoutForm.value });
    showToast('版面配置已保存，重新整理前台即可看到效果');
  } catch {
    showToast('保存失敗，請重試');
  } finally {
    albumLayoutSaving.value = false;
  }
}

function resetAlbumLayout() {
  albumLayoutForm.value = {
    wall: { ...DEFAULT_ALBUM_LAYOUT.wall },
    photos: { ...DEFAULT_ALBUM_LAYOUT.photos },
  };
}

function is401(e: unknown) {
  return (e as { response?: { status?: number } })?.response?.status === 401;
}

/** 从接口异常里取后端返回的错误文案 */
function errMsg(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

/** 加载计划列表 + 是否已初始化 */
async function loadPlans() {
  planLoading.value = true;
  try {
    const [list, state] = await Promise.all([
      adminGetPlans(),
      getPlansSeedState().catch(() => ({ seeded: false, count: 0 })),
    ]);
    planItems.value = list;
    planSeeded.value = state.seeded;
  } catch (e) {
    if (is401(e)) return;
    showToast('计划加载失败');
  } finally {
    planLoading.value = false;
  }
}

function logout() {
  adminLogout().catch(() => {
    /* 后端不可达也照常本地登出 */
  });
  setAdminToken('');
  loggedIn.value = false;
  showToast('已退出登录');
}

/* ---------------- 修改密码 ---------------- */
const pwdOpen = ref(false);
const pwdBusy = ref(false);
const pwdForm = ref({ old: '', next: '', confirm: '' });
const pwdErr = ref('');

function openPwd() {
  pwdForm.value = { old: '', next: '', confirm: '' };
  pwdErr.value = '';
  pwdOpen.value = true;
}

function closePwd() {
  pwdOpen.value = false;
  pwdErr.value = '';
}

async function submitPwd() {
  const errors: string[] = [];
  if (!pwdForm.value.old) errors.push('请输入旧密码');
  if (!pwdForm.value.next) errors.push('请输入新密码');
  if (!pwdForm.value.confirm) errors.push('请再次输入新密码');
  if (pwdForm.value.next && pwdForm.value.next.length < 6) errors.push('新密码至少 6 位');
  if (pwdForm.value.next && pwdForm.value.next.length > 64) errors.push('新密码最多 64 位');
  if (pwdForm.value.next && pwdForm.value.confirm && pwdForm.value.next !== pwdForm.value.confirm) {
    errors.push('两次输入的新密码不一致');
  }
  if (pwdForm.value.old && pwdForm.value.next && pwdForm.value.old === pwdForm.value.next) {
    errors.push('新密码不能与旧密码相同');
  }
  if (errors.length) {
    pwdErr.value = errors[0];
    return;
  }
  pwdBusy.value = true;
  pwdErr.value = '';
  try {
    await adminChangePassword({
      oldPassword: pwdForm.value.old,
      newPassword: pwdForm.value.next,
    });
    showToast('密码已修改，下次登录请使用新密码');
    closePwd();
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
    pwdErr.value = msg || '修改失败，请稍后再试';
  } finally {
    pwdBusy.value = false;
  }
}

/* ---------------- 登录 ---------------- */

async function doLogin() {
  loginError.value = '';
  if (!password.value.trim()) {
    loginError.value = '请输入密码';
    return;
  }
  loginBusy.value = true;
  try {
    const { token } = await adminLogin(password.value);
    setAdminToken(token);
    loggedIn.value = true;
    password.value = '';
    await loadAll();
    await loadProfile();
  } catch (e: any) {
    loginError.value = e?.response?.data?.error ?? '登录失败，请确认后端服务已启动';
  } finally {
    loginBusy.value = false;
  }
}

/* ---------------- 数据加载 ---------------- */

async function loadAll() {
  loading.value = true;
  try {
    const [ps, prs, ns, ms, cs, cms, fl, ac, bs] = await Promise.all([
      adminGetPosts(),
      adminGetProjects(),
      adminGetNotes(),
      adminGetMessages(),
      adminGetContacts(),
      adminGetComments(),
      adminGetFriendLinks(),
      adminGetAlbumCategories().catch(() => []),
      adminGetBanners().catch(() => []),
    ]);    posts.value = ps;
    projects.value = prs;
    notes.value = ns;
    messages.value = ms;
    contacts.value = cs;
    comments.value = cms;
    friendLinks.value = fl;
    albumCategories.value = ac;
    banners.value = bs;
    await loadPlans();
  } catch (e) {
    // 401 不登出：token 刚写入就被清会造成“瞬间被踢”，
    // 此处仅提示，由用户刷新后 onMounted 重新校验会话
    if (is401(e)) showToast('登录状态异常，请刷新页面重试');
    else showToast('数据加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadProfile() {
  try {
    profile.value = await getProfile();
    syncProfileForm();
  } catch {
    /* 忽略 */
  }
}

onMounted(async () => {
  // 恢复上次的导航收起状态
  sidebarCollapsed.value = localStorage.getItem(COLLAPSE_KEY) === '1';

  // 从地址栏恢复当前页面（支持 /admin?tab=settings 直接进入）
  if (isTabKey(route.query.tab)) {
    tab.value = route.query.tab;
    ensureGroupExpanded(route.query.tab);
  }

  const tokenAtMount = localStorage.getItem('admin_token') ?? '';
  try {
    if (tokenAtMount) {
      await adminMe();
      loggedIn.value = true;
      await loadAll();
      await loadProfile();
    }
  } catch (e) {
    if (is401(e)) {
      // 会话过期：只提示不清除，避免旧检查晚到时误删新登录写入的 token
      showToast('登录已过期，请重新登录');
    } else {
      // 网络错误（如后端未启动）：保留 token，恢复后刷新即可
      showToast('无法连接后端，请确认服务已启动');
    }
  } finally {
    checking.value = false;
  }
});

/** 切换 tab 时把状态写进地址栏 */
watch(tab, (next) => {
  ensureGroupExpanded(next);
  syncTabToQuery(next);
});

/** 支持浏览器前进/后退切换页面 */
watch(
  () => route.query.tab,
  (v) => {
    const next: Tab = isTabKey(v) ? v : 'posts';
    if (next !== tab.value) tab.value = next;
  }
);

/** 左栏收起状态持久化 */
watch(sidebarCollapsed, (v) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
});

/** 移动端抽屉打开时锁定页面滚动，关闭后恢复 */
watch(mobileNavOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

onUnmounted(() => {
  // 离开后台页时确保不残留滚动锁
  document.body.style.overflow = '';
});

/* ---------------- 文章 ---------------- */

async function savePost(payload: Partial<Post>) {
  try {
    if (payload.id) await adminUpdatePost(payload.id, payload);
    else await adminCreatePost(payload);
    postEditor.value = { open: false, post: null };
    await loadAll();
    showToast('文章已保存');
  } catch (e: any) {
    showToast(e?.response?.data?.error ?? '保存失败');
  }
}

async function removePost(p: Post) {
  if (!(await confirmNow({ title: '删除文章', message: `确定删除文章「${p.title}」？此操作不可恢复。`, danger: true }))) return;
  try {
    await adminDeletePost(p.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 项目 ---------------- */

async function saveProject(payload: Partial<Project>) {
  try {
    if (payload.id) await adminUpdateProject(payload.id, payload);
    else await adminCreateProject(payload);
    projectEditor.value = { open: false, project: null };
    await loadAll();
    showToast('项目已保存');
  } catch (e: any) {
    showToast(e?.response?.data?.error ?? '保存失败');
  }
}

async function removeProject(p: Project) {
  if (!(await confirmNow({ title: '删除项目', message: `确定删除项目「${p.title}」？此操作不可恢复。`, danger: true }))) return;
  try {
    await adminDeleteProject(p.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 留言 ---------------- */

async function toggleMessage(m: Message) {
  try {
    await adminToggleMessage(m.id, !m.visible);
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeMessage(m: Message) {
  if (!(await confirmNow({ title: '删除留言', message: `确定删除「${m.name}」的这条留言？`, danger: true }))) return;
  try {
    await adminDeleteMessage(m.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 联系消息 ---------------- */

async function markContactRead(c: ContactMessage) {
  try {
    await adminMarkContactRead(c.id, true);
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeContact(c: ContactMessage) {
  if (!(await confirmNow({ title: '删除来信', message: `确定删除「${c.name}」的来信？`, danger: true }))) return;
  try {
    await adminDeleteContact(c.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 图文笔记 ---------------- */

async function toggleNote(n: Note) {
  try {
    await adminToggleNote(n.id, !n.visible);
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeNote(n: Note) {
  if (!(await confirmNow({ title: '删除图文', message: `确定删除图文「${n.title}」？此操作不可恢复。`, danger: true }))) return;
  try {
    await adminDeleteNote(n.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 评论管理 ---------------- */

function noteTitleOf(noteId: string) {
  return notes.value.find((n) => n.id === noteId)?.title ?? noteId;
}

async function toggleComment(c: Comment) {
  try {
    await adminToggleComment(c.id, !c.visible);
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeComment(c: Comment) {
  if (!(await confirmNow({ title: '删除评论', message: `确定删除「${c.name}」的这条评论？`, danger: true }))) return;
  try {
    await adminDeleteComment(c.id);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 友链管理 ---------------- */

function openFriendForm(l?: FriendLink) {
  friendErr.value = '';
  if (l) {
    friendEditingId.value = l.id ?? '';
    friendForm.value = { name: l.name, url: l.url, desc: l.desc ?? '' };
  } else {
    friendEditingId.value = '';
    friendForm.value = { name: '', url: '', desc: '' };
  }
  friendFormOpen.value = true;
}

async function saveFriendLink() {
  friendErr.value = '';
  if (!friendForm.value.name.trim() || !friendForm.value.url.trim()) {
    friendErr.value = '请填写名称与网址';
    return;
  }
  try {
    const payload = {
      name: friendForm.value.name.trim(),
      url: friendForm.value.url.trim(),
      desc: friendForm.value.desc.trim(),
    };
    if (friendEditingId.value) await adminUpdateFriendLink(friendEditingId.value, payload);
    else await adminCreateFriendLink(payload);
    friendFormOpen.value = false;
    await loadAll();
    showToast('友链已保存');
  } catch (e: any) {
    friendErr.value = e?.response?.data?.error ?? '保存失败';
  }
}

async function toggleFriendLink(l: FriendLink) {
  try {
    await adminUpdateFriendLink(l.id!, { visible: !l.visible });
    await loadAll();
  } catch {
    showToast('操作失败');
  }
}

async function removeFriendLink(l: FriendLink) {
  if (!(await confirmNow({ title: '删除友链', message: `确定删除友链「${l.name}」？`, danger: true }))) return;
  try {
    await adminDeleteFriendLink(l.id!);
    await loadAll();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

/* ---------------- 相册管理 ---------------- */

async function loadAlbum() {
  try {
    albumCategories.value = await adminGetAlbumCategories();
  } catch {
    /* ignore */
  }
}

function openAlbumCatForm(cat?: AlbumCategory) {
  albumEditingCat.value = cat ?? null;
  albumForm.value = cat
    ? { title: cat.title, cover: cat.cover, desc: cat.desc, sort: cat.sort, password: '', passwordConfirm: '', clearPassword: false }
    : { title: '', cover: '', desc: '', sort: 0, password: '', passwordConfirm: '', clearPassword: false };
  albumFormOpen.value = true;
}

async function saveAlbumCategory() {
  if (!albumForm.value.title.trim()) { showToast('标题不能为空'); return; }
  try {
    if (albumEditingCat.value) {
      await adminUpdateAlbumCategory(albumEditingCat.value.id, albumForm.value);
      showToast('已更新');
    } else {
      await adminCreateAlbumCategory(albumForm.value);
      showToast('已创建');
    }
    albumFormOpen.value = false;
    await loadAlbum();
  } catch {
    showToast('保存失败');
  }
}

async function removeAlbumCategory(cat: AlbumCategory) {
  if (!(await confirmNow({ title: '删除相册分类', message: `确定删除相册分类「${cat.title}」？该分类下所有照片也会被删除。`, danger: true }))) return;
  try {
    await adminDeleteAlbumCategory(cat.id);
    if (albumCurrentCat.value?.id === cat.id) {
      albumCurrentCat.value = null;
      albumPhotos.value = [];
    }
    await loadAlbum();
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

function openAlbumPhotos(cat: AlbumCategory) {
  albumCurrentCat.value = cat;
  adminGetAlbumPhotos(cat.id)
    .then((data) => { albumPhotos.value = Array.isArray(data) ? data : []; })
    .catch(() => { albumPhotos.value = []; });
}

async function uploadAlbumPhotos(files: FileList | null) {
  if (!files || !files.length) return;
  if (!albumUploadCatId.value) { showToast('请先选择相册分类'); return; }
  albumUploading.value = true;
  try {
    const uploaded = await adminUploadAlbumPhotos(albumUploadCatId.value, Array.from(files));
    showToast(`已上传 ${uploaded.length} 张`);
    // 如果当前正在查看该分类，刷新照片列表
    if (albumCurrentCat.value?.id === albumUploadCatId.value) {
      await openAlbumPhotos(albumCurrentCat.value);
    }
  } catch (e: any) {
    showToast(e?.response?.data?.error || '上传失败');
  } finally {
    albumUploading.value = false;
  }
}

function onAlbumDragEnter(e: DragEvent) {
  if (!albumCurrentCat.value) return;
  e.preventDefault();
  e.stopPropagation();
  albumDragActive.value = true;
}

function onAlbumDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  // 只有真正离开容器才清除（子元素 dragleave 不触发）
  if (e.currentTarget === e.target) {
    albumDragActive.value = false;
  }
}

async function onAlbumDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  albumDragActive.value = false;
  if (!albumCurrentCat.value) return;
  const files = e.dataTransfer?.files;
  if (!files || !files.length) return;
  albumUploadCatId.value = albumCurrentCat.value.id;
  await uploadAlbumPhotos(files);
}

function openPhotoForm(p: AlbumPhoto) {
  albumPhotoForm.value = { id: p.id, caption: p.caption, categoryId: p.categoryId, sort: p.sort };
  albumPhotoFormOpen.value = true;
}

async function savePhotoForm() {
  try {
    await adminUpdateAlbumPhoto(albumPhotoForm.value.id, {
      caption: albumPhotoForm.value.caption,
      categoryId: albumPhotoForm.value.categoryId,
      sort: Number(albumPhotoForm.value.sort) || 0,
    });
    albumPhotoFormOpen.value = false;
    if (albumCurrentCat.value) await openAlbumPhotos(albumCurrentCat.value);
    showToast('已更新');
  } catch {
    showToast('保存失败');
  }
}

async function removePhoto(p: AlbumPhoto) {
  if (!(await confirmNow({ title: '删除照片', message: '确定删除这张照片？', danger: true }))) return;
  try {
    await adminDeleteAlbumPhoto(p.id);
    if (albumCurrentCat.value) await openAlbumPhotos(albumCurrentCat.value);
    showToast('已删除');
  } catch {
    showToast('删除失败');
  }
}

function handleAlbumCoverUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }
  const reader = new FileReader();
  reader.onload = () => { albumForm.value.cover = String(reader.result || ''); };
  reader.readAsDataURL(file);
  input.value = '';
}

/* ---------------- 资料设置 ---------------- */

const pf = ref({
  name: '',
  title: '',
  location: '',
  email: '',
  avatarText: '',
  avatar: '',
  bio: '',
  tagline: '',
  hobbies: '',
  socials: '',
  stats: '',
});

function splitLines(text: string) {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitComma(text: string) {
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function syncProfileForm() {
  const p = profile.value;
  if (!p) return;
  pf.value = {
    name: p.name,
    title: p.title,
    location: p.location,
    email: p.email,
    avatarText: p.avatarText,
    avatar: p.avatar || '',
    bio: (p.bio ?? []).join('\n'),
    tagline: (p.tagline ?? []).join('\n'),
    hobbies: (p.hobbies ?? []).join(', '),
    socials: (p.socials ?? []).map((s) => `${s.name}=${s.url}`).join('\n'),
    stats: (p.stats ?? []).map((s) => `${s.label}=${s.value}`).join('\n'),
  };
}

async function handleMusicSkinUpload(file: File) {
  if (!file.type.startsWith('image/')) { showToast('请上传图片'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }
  const reader = new FileReader();
  reader.onload = () => updateSettings({ musicSkinBg: reader.result as string });
  reader.readAsDataURL(file);
}

async function handleAvatarUpload(file: File) {
  if (!file.type.startsWith('image/')) { showToast('请上传图片文件'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过 2MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    pf.value.avatar = reader.result as string;
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  if (!pf.value.name.trim()) {
    showToast('姓名不能为空');
    return;
  }
  try {
    await adminUpdateProfile({
      name: pf.value.name.trim(),
      title: pf.value.title.trim(),
      location: pf.value.location.trim(),
      email: pf.value.email.trim(),
      avatarText: pf.value.avatarText.trim() || pf.value.name.trim().slice(0, 1),
      avatar: pf.value.avatar.trim(),
      bio: splitLines(pf.value.bio),
      tagline: splitLines(pf.value.tagline),
      hobbies: splitComma(pf.value.hobbies),
      socials: splitLines(pf.value.socials).map((line) => {
        const i = line.indexOf('=');
        return i > 0
          ? { name: line.slice(0, i).trim(), url: line.slice(i + 1).trim() }
          : { name: line, url: '#' };
      }),
      stats: splitLines(pf.value.stats).map((line) => {
        const i = line.indexOf('=');
        return i > 0
          ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }
          : { label: line, value: '0' };
      }),
    });
    await loadProfile();
    showToast('资料已保存');
  } catch (e: any) {
    showToast(e?.response?.data?.error ?? '保存失败');
  }
}
</script>

<template>
  <div class="shell pb-16 pt-28 md:pt-32">
    <!-- 登录态检查 -->
    <div v-if="checking" class="flex min-h-60 items-center justify-center">
      <div class="skeleton h-12 w-64 rounded-2xl" />
    </div>

    <!-- ============ 登录页 ============ -->
    <div v-else-if="!loggedIn" class="mx-auto max-w-md pt-8">
      <div v-reveal class="glass rounded-3xl p-8 md:p-10">
        <div class="flex flex-col items-center text-center">
          <span
            class="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30"
          >
            <AppIcon name="shield" class="size-7" />
          </span>
          <h1 class="mt-4 text-xl font-bold">{{ $t('admin.title') }}</h1>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ $t('admin.group.content') }} · {{ $t('admin.group.interaction') }} · {{ $t('admin.group.site') }}
          </p>
        </div>

        <form class="mt-8 space-y-4" @submit.prevent="doLogin">
          <div>
            <label for="admin-pwd" class="mb-1.5 block text-sm font-medium">{{ $t('admin.password') }}</label>
            <input
              id="admin-pwd"
              v-model="password"
              type="password"
              autocomplete="new-password"
              :placeholder="$t('admin.password')"
              class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <p v-if="loginError" class="flex items-center gap-1.5 text-sm text-red-500">
            <AppIcon name="alert-circle" class="size-4" />
            {{ loginError }}
          </p>
          <button
            type="submit"
            class="btn-primary w-full justify-center disabled:opacity-60"
            :disabled="loginBusy"
          >
            <AppIcon name="shield" class="size-4" />
            {{ loginBusy ? $t('common.loading') : $t('admin.login') }}
          </button>
        </form>

        <p class="mt-6 rounded-xl bg-cyan-500/10 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {{ $t('admin.defaultPassword') }} <code class="font-mono text-cyan-600 dark:text-cyan-400">admin123</code>。
          {{ $t('admin.setEnvVar') }}
          <code class="font-mono text-cyan-600 dark:text-cyan-400">ADMIN_PASSWORD</code> {{ $t('admin.changePassword') }}。
        </p>
      </div>
    </div>

    <!-- ============ 管理面板 ============ -->
    <div v-else>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold md:text-3xl">后台管理</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            所有修改会实时保存到 server/data/db.json，刷新前台页面即生效
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ghost !py-2 text-sm" @click="openPwd">
            <AppIcon name="key" class="size-4" />
            修改密码
          </button>
          <button type="button" class="btn-ghost !py-2 text-sm" @click="logout">
            <AppIcon name="log-out" class="size-4" />
            退出登录
          </button>
        </div>
      </div>

      <!-- 修改密码弹层 -->
      <div
        v-if="pwdOpen"
        class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closePwd"
      >
        <div class="modal-surface w-full max-w-md rounded-3xl p-6 md:p-8">
          <div class="mb-4 flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/60">
            <h2 class="flex items-center gap-2 text-lg font-semibold">
              <AppIcon name="key" class="size-5 text-cyan-600 dark:text-cyan-400" />
              修改后台密码
            </h2>
            <button type="button" class="text-slate-400 hover:text-slate-600" @click="closePwd">
              <AppIcon name="x" class="size-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium">旧密码</label>
              <input
                v-model="pwdForm.old"
                type="password"
                autocomplete="current-password"
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                placeholder="输入当前密码"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium">新密码</label>
              <input
                v-model="pwdForm.next"
                type="password"
                autocomplete="new-password"
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                placeholder="6-64 位"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium">确认新密码</label>
              <input
                v-model="pwdForm.confirm"
                type="password"
                autocomplete="new-password"
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                placeholder="再次输入新密码"
              />
            </div>
            <p v-if="pwdErr" class="text-sm text-red-500">{{ pwdErr }}</p>
          </div>

          <div class="mt-6 flex justify-end gap-2 border-t border-slate-200/70 pt-5 dark:border-slate-700/60">
            <button type="button" class="btn-ghost !py-2 text-sm" :disabled="pwdBusy" @click="closePwd">
              <AppIcon name="close" class="size-4" />
              取消
            </button>
            <button type="button" class="btn-primary !py-2 text-sm" :disabled="pwdBusy" @click="submitPwd">
              <AppIcon name="check" class="size-4" />
              {{ pwdBusy ? '提交中…' : '确认修改' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 移动端：顶部概览条 + 抽屉开关 -->
      <div class="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          class="glass inline-flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
          @click="mobileNavOpen = true"
        >
          <AppIcon :name="currentTabMeta.icon" class="size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ $t(currentTabMeta.label as any) }}</span>
            <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ $t(currentTabMeta.desc as any) }}</span>
          </span>
          <AppIcon name="menu" class="size-4 shrink-0 text-slate-400" />
        </button>
      </div>

      <!-- 移动端抽屉 -->
      <div v-if="mobileNavOpen" class="fixed inset-0 z-50 lg:hidden" @click.self="mobileNavOpen = false">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="mobileNavOpen = false" />
        <aside class="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900">
          <div class="mb-4 flex items-center justify-between">
            <span class="font-semibold">功能导航</span>
            <button type="button" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" @click="mobileNavOpen = false">
              <AppIcon name="x" class="size-5" />
            </button>
          </div>
          <nav class="space-y-4">
            <div v-for="g in TAB_GROUPS" :key="g.key">
              <p class="mb-1.5 px-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">{{ $t(g.label as any) }}</p>
              <div class="space-y-1">
                <button
                  v-for="t in g.items"
                  :key="t.key"
                  type="button"
                  class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  :class="
                    tab === t.key
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  "
                  @click="selectTab(t.key)"
                >
                  <AppIcon :name="t.icon" class="size-4 shrink-0" />
                  {{ $t(t.label as any) }}
                </button>
              </div>
            </div>
          </nav>
        </aside>
      </div>

      <!-- ===== 主体：左栏分组导航 + 右侧内容 ===== -->
      <div class="flex items-start gap-6" :class="sidebarCollapsed ? '' : 'lg:gap-7'">
        <!-- 左栏（桌面端） -->
        <aside
          v-if="!sidebarCollapsed"
          class="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-60 shrink-0 overflow-y-auto lg:block"
        >
          <div class="glass rounded-2xl p-3">
            <nav class="space-y-1">
              <div v-for="g in TAB_GROUPS" :key="g.key">
                <!-- 分组头：点击折叠/展开 -->
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-500/5 dark:hover:bg-slate-400/5"
                  @click="toggleGroup(g.key)"
                >
                  <AppIcon :name="g.icon" class="size-4 shrink-0 text-slate-400" />
                  <span class="flex-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {{ $t(g.label as any) }}
                  </span>
                  <AppIcon
                    name="chevron-down"
                    class="size-3.5 shrink-0 text-slate-400 transition-transform duration-200"
                    :class="expandedGroups[g.key] ? '' : '-rotate-90'"
                  />
                </button>

                <!-- 分组子项 -->
                <div v-show="expandedGroups[g.key]" class="mt-0.5 space-y-0.5 pl-1.5">
                  <button
                    v-for="t in g.items"
                    :key="t.key"
                    type="button"
                    class="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-all"
                    :class="
                      tab === t.key
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                        : 'text-slate-600 hover:bg-slate-500/8 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400'
                    "
                    @click="selectTab(t.key)"
                  >
                    <AppIcon :name="t.icon" class="size-4 shrink-0" />
                    <span class="truncate">{{ $t(t.label as any) }}</span>
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </aside>

        <!-- 右侧内容区 -->
        <div class="min-w-0 flex-1">
          <!-- 内容区标题条 -->
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <button
                v-if="sidebarCollapsed"
                type="button"
                class="glass hidden size-9 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:text-cyan-600 lg:grid dark:text-slate-400"
                title="展开导航栏"
                @click="sidebarCollapsed = false"
              >
                <AppIcon name="menu" class="size-4" />
              </button>
              <div class="min-w-0">
                <h2 class="truncate text-lg font-semibold">{{ $t(currentTabMeta.label as any) }}</h2>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ $t(currentTabMeta.desc as any) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!sidebarCollapsed"
                type="button"
                class="glass hidden size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:text-cyan-600 lg:grid dark:text-slate-400"
                title="收起导航栏"
                @click="sidebarCollapsed = true"
              >
                <AppIcon name="chevrons-left" class="size-4" />
              </button>
              <!-- 快速切换：直达其他页面，不用回左侧找 -->
              <div class="relative">
                <select
                  class="glass cursor-pointer appearance-none rounded-xl py-2 pr-8 pl-3.5 text-sm font-medium text-slate-600 outline-none transition-colors hover:text-cyan-600 dark:text-slate-300"
                  :value="tab"
                  @change="selectTab(($event.target as HTMLSelectElement).value as Tab)"
                >
                  <optgroup v-for="g in TAB_GROUPS" :key="g.key" :label="$t(g.label as any)">
                    <option v-for="t in g.items" :key="t.key" :value="t.key">{{ $t(t.label as any) }}</option>
                  </optgroup>
                </select>
                <AppIcon
                  name="chevron-down"
                  class="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>

          <!-- ===== 文章管理 ===== -->
      <section v-if="tab === 'posts'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">文章（{{ posts.length }}）</h2>
          <div class="flex items-center gap-2">
            <div class="flex rounded-full border border-slate-200 p-0.5 text-xs dark:border-slate-700">
              <button
                v-for="c in postFilters"
                :key="c"
                type="button"
                class="rounded-full px-3 py-1.5 font-medium transition-colors"
                :class="
                  postFilter === c
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'text-slate-500 hover:text-cyan-600 dark:text-slate-400'
                "
                @click="postFilter = c"
              >
                {{ c === 'all' ? '全部' : c === 'blog' ? '博客' : '随笔' }}
              </button>
            </div>
            <button type="button" class="btn-primary !px-5 !py-2.5 text-sm" @click="postEditor = { open: true, post: null }">
              <AppIcon name="plus" class="size-4" />
              新增文章
            </button>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="p in filteredPosts" :key="p.id" class="glass flex flex-wrap items-center gap-3 rounded-2xl p-5">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    (p.category ?? 'blog') === 'blog'
                      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  "
                >
                  {{ (p.category ?? 'blog') === 'blog' ? '博客' : '随笔' }}
                </span>
                <span class="truncate font-semibold">{{ p.title }}</span>
                <span v-for="t in p.tags" :key="t" class="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-700 dark:text-cyan-400">{{ t }}</span>
              </div>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ p.date }} · {{ p.readMinutes }} 分钟阅读 · id: {{ p.id }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="postEditor = { open: true, post: p }">
                <AppIcon name="edit" class="size-3.5" />
                编辑
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removePost(p)">
                <AppIcon name="trash" class="size-3.5" />
                删除
              </button>
            </div>
          </div>
          <p v-if="!filteredPosts.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无文章，点击右上角新增</p>
        </div>
      </section>

      <!-- ===== 项目管理 ===== -->
      <section v-if="tab === 'projects'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">项目（{{ projects.length }}）</h2>
          <button type="button" class="btn-primary !px-5 !py-2.5 text-sm" @click="projectEditor = { open: true, project: null }">
            <AppIcon name="plus" class="size-4" />
            新增项目
          </button>
        </div>
        <div class="space-y-3">
          <div v-for="p in projects" :key="p.id" class="glass flex flex-wrap items-center gap-3 rounded-2xl p-5">
            <span class="size-10 shrink-0 rounded-xl" :style="{ background: p.gradient }" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ p.title }}</span>
                <span v-if="p.featured" class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">精选</span>
                <span v-for="t in p.tags" :key="t" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ t }}</span>
              </div>
              <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{{ p.desc }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="projectEditor = { open: true, project: p }">
                <AppIcon name="edit" class="size-3.5" />
                编辑
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeProject(p)">
                <AppIcon name="trash" class="size-3.5" />
                删除
              </button>
            </div>
          </div>
          <p v-if="!projects.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无项目，点击右上角新增</p>
        </div>
      </section>

      <!-- ===== 图文管理 ===== -->
      <section v-if="tab === 'notes'">
        <h2 class="mb-4 font-semibold">图文笔记（{{ notes.length }}）</h2>
        <div class="space-y-3">
          <div v-for="n in notes" :key="n.id" class="glass flex flex-wrap items-center gap-4 rounded-2xl p-4" :class="{ 'opacity-60': !n.visible }">
            <img
              :src="n.images[0]"
              :alt="n.title"
              class="h-16 w-14 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ n.title }}</span>
                <span v-if="n.images.length > 1" class="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <AppIcon name="layers" class="size-3" />
                  {{ n.images.length }} 图
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="n.visible ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
                >
                  {{ n.visible ? '公开中' : '已隐藏' }}
                </span>
              </div>
              <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {{ n.date }} · {{ n.likes }} 赞 · {{ n.author }}
                <span v-for="t in n.tags" :key="t" class="ml-1 text-red-500">#{{ t }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="toggleNote(n)">
                <AppIcon :name="n.visible ? 'eye-off' : 'eye'" class="size-3.5" />
                {{ n.visible ? '隐藏' : '显示' }}
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeNote(n)">
                <AppIcon name="trash" class="size-3.5" />
                删除
              </button>
            </div>
          </div>
          <p v-if="!notes.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无图文，可在「图文」专栏页发布</p>
        </div>
      </section>

      <!-- ===== 评论管理 ===== -->
      <section v-if="tab === 'comments'">
        <h2 class="mb-4 font-semibold">评论（{{ comments.length }}）</h2>
        <div class="space-y-3">
          <div v-for="c in comments" :key="c.id" class="glass rounded-2xl p-5" :class="{ 'opacity-60': !c.visible }">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold">{{ c.name }}</span>
              <span class="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-500">评论于「{{ noteTitleOf(c.noteId) }}」</span>
              <span class="text-xs text-slate-400">{{ new Date(c.date).toLocaleString() }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="c.visible ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
              >
                {{ c.visible ? '公开中' : '已隐藏' }}
              </span>
              <span class="ml-auto flex items-center gap-2">
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="toggleComment(c)">
                  <AppIcon :name="c.visible ? 'eye-off' : 'eye'" class="size-3.5" />
                  {{ c.visible ? '隐藏' : '显示' }}
                </button>
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeComment(c)">
                  <AppIcon name="trash" class="size-3.5" />
                  删除
                </button>
              </span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ c.content }}</p>
          </div>
          <p v-if="!comments.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无评论</p>
        </div>
      </section>

      <!-- ===== 友链管理 ===== -->
      <section v-if="tab === 'friendlinks'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">友链（{{ friendLinks.length }}）</h2>
          <button type="button" class="btn-primary !px-5 !py-2.5 text-sm" @click="openFriendForm()">
            <AppIcon name="plus" class="size-4" />
            新增友链
          </button>
        </div>

        <form
          v-if="friendFormOpen"
          class="glass mb-5 rounded-2xl p-5"
          @submit.prevent="saveFriendLink"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <input
              v-model="friendForm.name"
              type="text"
              maxlength="30"
              placeholder="站点名称 *"
              class="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
            <input
              v-model="friendForm.url"
              type="url"
              maxlength="200"
              placeholder="网址 https://… *"
              class="rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <input
            v-model="friendForm.desc"
            type="text"
            maxlength="120"
            placeholder="一句话简介"
            class="mt-4 w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
          <p v-if="friendErr" class="mt-2 text-xs text-red-500">{{ friendErr }}</p>
          <div class="mt-4 flex justify-end gap-3">
            <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="friendFormOpen = false">
              <AppIcon name="close" class="size-3.5" />
              取消
            </button>
            <button type="submit" class="btn-primary !px-5 !py-2 text-xs">
              <AppIcon name="check" class="size-3.5" />
              保存
            </button>
          </div>
        </form>

        <div class="space-y-3">
          <div v-for="l in friendLinks" :key="l.id" class="glass flex flex-wrap items-center gap-3 rounded-2xl p-5" :class="{ 'opacity-60': !l.visible }">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="truncate font-semibold">{{ l.name }}</span>
                <a
                  :href="l.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-underline max-w-[45%] truncate text-xs text-cyan-600 dark:text-cyan-400"
                >
                  {{ l.url }}
                </a>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="l.visible ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'"
                >
                  {{ l.visible ? '展示中' : '待审核' }}
                </span>
              </div>
              <p v-if="l.desc" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ l.desc }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="openFriendForm(l)">
                <AppIcon name="edit" class="size-3.5" />
                编辑
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="toggleFriendLink(l)">
                <AppIcon :name="l.visible ? 'eye-off' : 'eye'" class="size-3.5" />
                {{ l.visible ? '隐藏' : '显示' }}
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeFriendLink(l)">
                <AppIcon name="trash" class="size-3.5" />
                删除
              </button>
            </div>
          </div>
          <p v-if="!friendLinks.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无友链</p>
        </div>
      </section>

      <!-- ===== 留言管理 ===== -->
      <section v-if="tab === 'messages'">
        <h2 class="mb-4 font-semibold">留言（{{ messages.length }}）</h2>
        <div class="space-y-3">
          <div v-for="m in messages" :key="m.id" class="glass rounded-2xl p-5" :class="{ 'opacity-60': !m.visible }">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold">{{ m.name }}</span>
              <span class="text-xs text-slate-400">{{ m.date }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="m.visible ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
              >
                {{ m.visible ? '公开中' : '已隐藏' }}
              </span>
              <span class="ml-auto flex items-center gap-2">
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="toggleMessage(m)">
                  <AppIcon :name="m.visible ? 'eye-off' : 'eye'" class="size-3.5" />
                  {{ m.visible ? '隐藏' : '显示' }}
                </button>
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeMessage(m)">
                  <AppIcon name="trash" class="size-3.5" />
                  删除
                </button>
              </span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ m.content }}</p>
          </div>
          <p v-if="!messages.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无留言</p>
        </div>
      </section>

      <!-- ===== 联系消息 ===== -->
      <section v-if="tab === 'contacts'">
        <h2 class="mb-4 font-semibold">联系来信（{{ contacts.length }}）</h2>
        <div class="space-y-3">
          <div v-for="c in contacts" :key="c.id" class="glass rounded-2xl p-5" :class="{ 'opacity-60': c.read }">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold">{{ c.name }}</span>
              <a :href="`mailto:${c.email}`" class="text-xs text-cyan-600 dark:text-cyan-400">{{ c.email }}</a>
              <span class="text-xs text-slate-400">{{ new Date(c.date).toLocaleString() }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="c.read ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'"
              >
                {{ c.read ? '已读' : '未读' }}
              </span>
              <span class="ml-auto flex items-center gap-2">
                <button v-if="!c.read" type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="markContactRead(c)">
                  <AppIcon name="check" class="size-3.5" />
                  标记已读
                </button>
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs !text-red-500 hover:!border-red-400" @click="removeContact(c)">
                  <AppIcon name="trash" class="size-3.5" />
                  删除
                </button>
              </span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ c.message }}</p>
          </div>
          <p v-if="!contacts.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无来信</p>
        </div>
      </section>

      <!-- ===== 网址导航管理 ===== -->
      <section v-if="tab === 'nav'">
        <NavManager />
      </section>

      <!-- ===== 相册管理 ===== -->
      <section v-if="tab === 'album'">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">相册分类</h2>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
            @click="openAlbumCatForm()"
          >
            <AppIcon name="plus" class="size-4" />
            新建分类
          </button>
        </div>

        <!-- 版面配置 -->
        <div class="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                <AppIcon name="sliders" class="size-4" />
                版面配置
              </h3>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                控制前台相册墙、相册卡片与相册内照片的摆放效果
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <a
                href="/album"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                <AppIcon name="external" class="size-3.5" />
                前台预览
              </a>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                @click="resetAlbumLayout"
              >
                还原默认
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
                :disabled="albumLayoutSaving"
                @click="saveAlbumLayout"
              >
                <AppIcon :name="albumLayoutSaving ? 'refresh-cw' : 'check'" class="size-3.5" />
                {{ albumLayoutSaving ? '保存中…' : '保存配置' }}
              </button>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <!-- 相册墙 -->
            <div class="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-900/30">
              <h4 class="mb-3 text-sm font-medium text-slate-800 dark:text-slate-100">相册墙（相册列表页）</h4>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">摆放风格</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in WALL_LAYOUT_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.wall.layout === opt.value)"
                    :style="segStyle(albumLayoutForm.wall.layout === opt.value)"
                    @click="albumLayoutForm.wall.layout = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <p class="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {{ WALL_LAYOUT_OPTIONS.find((o) => o.value === albumLayoutForm.wall.layout)?.desc }}
                </p>
              </div>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">列数</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in WALL_COL_OPTIONS"
                    :key="String(opt.value)"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.wall.columns === opt.value)"
                    :style="segStyle(albumLayoutForm.wall.columns === opt.value)"
                    @click="albumLayoutForm.wall.columns = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">卡片尺寸</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in WALL_SIZE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.wall.size === opt.value)"
                    :style="segStyle(albumLayoutForm.wall.size === opt.value)"
                    @click="albumLayoutForm.wall.size = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div v-if="albumLayoutForm.wall.layout === 'tilt'" class="mb-3">
                <label class="mb-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>错落角度</span>
                  <span class="font-medium text-slate-700 dark:text-slate-200">{{ albumLayoutForm.wall.tilt }}°</span>
                </label>
                <input
                  v-model.number="albumLayoutForm.wall.tilt"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  class="w-full"
                  style="accent-color: var(--accent-1)"
                />
              </div>

              <div class="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <ToggleSwitch v-model="albumLayoutForm.wall.showCount" />
                  显示照片数量
                </label>
                <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <ToggleSwitch v-model="albumLayoutForm.wall.showDesc" />
                  显示相册描述
                </label>
              </div>
            </div>

            <!-- 相册内照片 -->
            <div class="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-900/30">
              <h4 class="mb-3 text-sm font-medium text-slate-800 dark:text-slate-100">相册内照片</h4>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">摆放风格</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in PHOTO_LAYOUT_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.photos.layout === opt.value)"
                    :style="segStyle(albumLayoutForm.photos.layout === opt.value)"
                    @click="albumLayoutForm.photos.layout = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <p class="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {{ PHOTO_LAYOUT_OPTIONS.find((o) => o.value === albumLayoutForm.photos.layout)?.desc }}
                </p>
              </div>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">列数</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in PHOTO_COL_OPTIONS"
                    :key="String(opt.value)"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.photos.columns === opt.value)"
                    :style="segStyle(albumLayoutForm.photos.columns === opt.value)"
                    @click="albumLayoutForm.photos.columns = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">间距</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in PHOTO_GAP_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                    :class="segClass(albumLayoutForm.photos.gap === opt.value)"
                    :style="segStyle(albumLayoutForm.photos.gap === opt.value)"
                    @click="albumLayoutForm.photos.gap = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <label class="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">
                  裁剪比例
                  <span v-if="albumLayoutForm.photos.layout !== 'grid'">（仅等宽网格生效）</span>
                </label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in PHOTO_RATIO_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    :class="segClass(albumLayoutForm.photos.ratio === opt.value)"
                    :style="segStyle(albumLayoutForm.photos.ratio === opt.value)"
                    :disabled="albumLayoutForm.photos.layout !== 'grid'"
                    @click="albumLayoutForm.photos.ratio = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <div class="pt-1">
                <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <ToggleSwitch v-model="albumLayoutForm.photos.rounded" />
                  照片圆角
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 分类列表 -->
        <div v-if="!albumCurrentCat" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="cat in albumCategories"
            :key="cat.id"
            class="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
          >
            <div class="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
              <img
                v-if="cat.cover"
                :src="cat.cover"
                :alt="cat.title"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-4xl"
                :style="{ background: 'linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.2), rgba(var(--accent-2-rgb), 0.2))' }"
              >
                📷
              </div>
              <button
                type="button"
                class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                @click="openAlbumPhotos(cat)"
              >
                <span class="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1 text-sm backdrop-blur">
                  <AppIcon name="image" class="size-4" />
                  查看照片
                </span>
              </button>
            </div>
            <div class="p-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                    {{ cat.title }}
                    <span v-if="cat.hasPassword" class="text-xs" title="已设置分类密码">🔒</span>
                  </h3>
                  <p v-if="cat.desc" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ cat.desc }}</p>
                </div>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700"
                    title="编辑"
                    @click.stop="openAlbumCatForm(cat)"
                  >
                    <AppIcon name="edit" class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                    title="删除"
                    @click.stop="removeAlbumCategory(cat)"
                  >
                    <AppIcon name="trash" class="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!albumCategories.length"
            class="col-span-full rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400 dark:border-slate-700"
          >
            暂无相册分类，点击上方「+ 新建分类」开始
          </div>
        </div>

        <!-- 照片管理 -->
        <div
          v-else
          class="album-dropzone relative min-h-[300px] rounded-xl border-2 transition-colors"
          :class="albumDragActive ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-900/20' : 'border-transparent'"
          @dragenter="onAlbumDragEnter"
          @dragover="onAlbumDragEnter"
          @dragleave="onAlbumDragLeave"
          @drop="onAlbumDrop"
        >
          <!-- 拖拽覆盖层 -->
          <Transition name="fade">
            <div
              v-if="albumDragActive"
              class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-cyan-500/10 backdrop-blur-sm"
            >
              <AppIcon name="upload" class="mb-2 size-10 text-cyan-500" />
              <p class="text-base font-medium text-cyan-600 dark:text-cyan-400">松开鼠标上传图片</p>
              <p class="mt-1 text-xs text-cyan-500/70">支持多张图片，最大 8MB/张</p>
            </div>
          </Transition>

          <div class="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              @click="albumCurrentCat = null; albumPhotos = []"
            >
              <AppIcon name="chevron-left" class="size-4" />
              返回分类
            </button>
            <h3 class="flex-1 text-center font-medium">
              {{ albumCurrentCat.title }} <span class="text-xs text-slate-400">({{ albumPhotos.length }} 张)</span>
            </h3>
            <label
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                :disabled="albumUploading"
                @change="(e) => { albumUploadCatId = albumCurrentCat!.id; uploadAlbumPhotos((e.target as HTMLInputElement).files); (e.target as HTMLInputElement).value = ''; }"
              />
              <AppIcon v-if="!albumUploading" name="upload" class="size-4" />
              <span>{{ albumUploading ? '上传中...' : '上传照片' }}</span>
            </label>
          </div>

          <!-- 照片网格 -->
          <div v-if="albumPhotos.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <div
              v-for="p in albumPhotos"
              :key="p.id"
              class="group relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700"
            >
              <img
                :src="p.url"
                :alt="p.caption || ''"
                loading="lazy"
                class="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <span class="truncate text-xs text-white">{{ p.caption }}</span>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="rounded p-1 text-white/80 hover:bg-white/20"
                    title="编辑"
                    @click.stop="openPhotoForm(p)"
                  >
                    <AppIcon name="edit" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 text-white/80 hover:bg-rose-500"
                    title="删除"
                    @click.stop="removePhoto(p)"
                  >
                    <AppIcon name="trash" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态：拖拽提示 -->
          <div v-else class="flex flex-col items-center justify-center py-16">
            <div class="mb-3 rounded-full p-4" :style="{ background: 'linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.15), rgba(var(--accent-2-rgb), 0.15))' }">
              <AppIcon name="upload" class="size-8" :style="{ color: 'var(--accent-1)' }" />
            </div>
            <p class="text-sm font-medium text-slate-600 dark:text-slate-300">拖放图片到此处或点击上方按钮上传</p>
            <p class="mt-1 text-xs text-slate-400">支持多张图片同时上传，最大 8MB/张</p>
          </div>
        </div>
      </section>

      <!-- ===== 轮播图管理 ===== -->
      <section v-if="tab === 'plans'">
        <!-- 说明 + 操作 -->
        <div class="glass mb-5 rounded-2xl p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="flex items-center gap-2 text-sm font-semibold">
                <AppIcon name="compass" class="size-4 text-cyan-500" />
                计划管理
              </h3>
              <p class="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                上传 Markdown / HTML 计划文档，后端会自动解析成与前台一致的页面结构（标题、区块、表格、时间线、预算、要点提醒）。
                解析结果会先填进编辑弹窗，确认或微调后再保存。
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input
                ref="planFileInput"
                type="file"
                accept=".md,.markdown,.html,.htm,.txt"
                class="hidden"
                @change="handlePlanUpload"
              />
              <button
                type="button"
                class="btn-primary !px-4 !py-2 text-xs"
                :disabled="planParsing"
                @click="planFileInput?.click()"
              >
                <AppIcon name="upload" class="size-4" />
                {{ planParsing ? '解析中…' : '上传 md / html 生成' }}
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="openPlanForm()">
                <AppIcon name="plus" class="size-4" />
                手动新增
              </button>
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="downloadPlanTemplate">
                <AppIcon name="book" class="size-4" />
                下载模板
              </button>
              <button
                v-if="!planSeeded || !planItems.length"
                type="button"
                class="btn-ghost !px-4 !py-2 text-xs"
                :disabled="planImporting"
                @click="importBuiltinPlans"
              >
                <AppIcon name="layers" class="size-4" />
                {{ planImporting ? '导入中…' : `导入内置 ${builtinPlans.length} 个计划` }}
              </button>
            </div>
          </div>
        </div>

        <!-- 未初始化提示 -->
        <div
          v-if="!planSeeded"
          class="mb-5 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
          计划库尚未初始化，前台当前展示的是内置数据（只读）。点上方「导入内置计划」把它们写入数据库，之后即可在这里自由增删改。
        </div>

        <!-- 列表 -->
        <div v-if="planLoading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="i in 3" :key="i" class="glass h-56 animate-pulse rounded-2xl" />
        </div>

        <div v-else-if="!planItems.length" class="glass rounded-3xl p-10 text-center">
          <AppIcon name="compass" class="mx-auto size-10 text-slate-300" />
          <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
            还没有计划，上传一份 md / html 试试
          </p>
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="(p, i) in planItems"
            :key="p.id"
            class="glass flex flex-col overflow-hidden rounded-2xl"
          >
            <!-- 封面 -->
            <div class="relative h-28 bg-gradient-to-br" :class="p.gradient">
              <span
                class="pointer-events-none absolute -right-2 -top-4 select-none text-[5rem] leading-none opacity-25"
                aria-hidden="true"
              >
                {{ p.emoji }}
              </span>
              <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
                <span class="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
                  {{ CATEGORY_EMOJI[p.category] }} {{ PLAN_CAT_LABELS[p.category] }}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] text-white"
                  :class="p.visible ? 'bg-emerald-500/90' : 'bg-slate-500/80'"
                >
                  {{ p.visible ? '显示' : '隐藏' }}
                </span>
              </div>
            </div>

            <!-- 信息 -->
            <div class="flex flex-1 flex-col p-4">
              <h4 class="font-semibold leading-snug">{{ p.title }}</h4>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {{ p.subtitle || p.summary }}
              </p>
              <p class="mt-2 text-[11px] text-slate-400">
                {{ p.sections.length }} 个区块 · {{ planEntryCount(p) }} 条内容
              </p>
              <p class="mt-0.5 truncate text-[11px] text-slate-400">id: {{ p.id }}</p>

              <!-- 操作 -->
              <div class="mt-3 flex items-center gap-1 border-t border-slate-200 pt-3 dark:border-slate-700">
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
                  title="编辑"
                  @click="openPlanForm(p)"
                >
                  <AppIcon name="edit" class="size-4" />
                </button>
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
                  :title="p.visible ? '隐藏' : '显示'"
                  @click="togglePlanVisible(p)"
                >
                  <AppIcon :name="p.visible ? 'eye' : 'eye-off'" class="size-4" />
                </button>
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-800"
                  title="上移"
                  :disabled="i === 0"
                  @click="movePlan(p, -1)"
                >
                  <AppIcon name="chevron-up" class="size-4" />
                </button>
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-800"
                  title="下移"
                  :disabled="i === planItems.length - 1"
                  @click="movePlan(p, 1)"
                >
                  <AppIcon name="chevron-down" class="size-4" />
                </button>
                <span class="flex-1" />
                <RouterLink
                  :to="`/plans/${p.id}`"
                  target="_blank"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
                  title="前台预览"
                >
                  <AppIcon name="external" class="size-4" />
                </RouterLink>
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  title="删除"
                  @click="removePlan(p)"
                >
                  <AppIcon name="trash" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="tab === 'banners'">
        <!-- 全局配置 -->
        <div class="glass mb-5 rounded-2xl p-5">
          <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AppIcon name="settings" class="size-4 text-cyan-500" />
            全局配置
          </h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">首页轮播显示</p>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">关闭后首页不再展示精选文章轮播</p>
              </div>
              <ToggleSwitch
                :model-value="showCarousel"
                :disabled="settingsSaving"
                @update:model-value="toggleSetting('showCarousel')"
              />
            </div>

            <div class="border-t border-slate-200 dark:border-slate-700" />

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">分页器与导航</p>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">开启后显示顶部进度条、底部圆点指示器和左右箭头</p>
              </div>
              <ToggleSwitch
                :model-value="carouselPaginate"
                :disabled="settingsSaving"
                @update:model-value="toggleSetting('carouselPaginate')"
              />
            </div>

            <div class="border-t border-slate-200 dark:border-slate-700" />

            <div>
              <label class="mb-1.5 block font-medium text-sm">自动切换间隔</label>
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  :value="carouselInterval"
                  min="2000"
                  max="15000"
                  step="500"
                  :disabled="settingsSaving"
                  class="flex-1 accent-cyan-500"
                  @input="(e) => { const v = Number((e.target as HTMLInputElement).value); updateSettings({ carouselInterval: v }); }"
                />
                <span class="w-16 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                  {{ carouselInterval / 1000 }} 秒
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="font-semibold">轮播项列表</h2>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              管理首页轮播项，每张图可独立配置标题、副标题、描述文字及样式
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
            @click="openBannerForm()"
          >
            <AppIcon name="plus" class="size-4" />
            新增轮播项
          </button>
        </div>

        <!-- 轮播图列表 -->
        <div v-if="!banners.length" class="glass rounded-3xl p-10 text-center">
          <AppIcon name="image" class="mx-auto size-10 text-slate-300" />
          <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">暂无轮播项，点击「新增轮播项」开始添加</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            v-for="b in [...banners].sort((a, b) => a.sort - b.sort)"
            :key="b.id"
            class="glass overflow-hidden rounded-2xl"
          >
            <!-- 预览图 -->
            <div class="relative h-40 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
              <img
                v-if="b.image"
                :src="b.image"
                :alt="b.title"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="h-full w-full"
                :class="`bg-gradient-to-br ${b.gradient}`"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              <!-- 状态标签 -->
              <div class="absolute left-3 top-3 flex gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="b.visible ? 'bg-emerald-500/90 text-white' : 'bg-slate-500/70 text-white'"
                >
                  {{ b.visible ? '显示' : '隐藏' }}
                </span>
                <span class="rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
                  排序 {{ b.sort }}
                </span>
              </div>

              <!-- 操作按钮 -->
              <div class="absolute right-3 top-3 flex gap-2">
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                  title="编辑"
                  @click="openBannerForm(b)"
                >
                  <AppIcon name="edit" class="size-4" />
                </button>
                <button
                  type="button"
                  class="grid size-8 place-items-center rounded-lg bg-black/40 text-white backdrop-blur-sm transition hover:bg-red-500/80"
                  title="删除"
                  @click="removeBanner(b)"
                >
                  <AppIcon name="trash" class="size-4" />
                </button>
              </div>

              <!-- 标题预览 -->
              <div class="absolute inset-x-0 bottom-0 p-3">
                <p class="truncate text-sm font-semibold text-white">{{ b.title }}</p>
                <p v-if="b.subtitle" class="mt-0.5 truncate text-xs text-white/75">{{ b.subtitle }}</p>
              </div>
            </div>

            <!-- 底部信息 -->
            <div class="flex items-center justify-between px-4 py-2.5 text-xs">
              <span class="text-slate-500 dark:text-slate-400">
                {{ b.kind }} · 跳转 {{ b.to }}
              </span>
              <button
                type="button"
                class="text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-400"
                @click="toggleBannerVisible(b)"
              >
                {{ b.visible ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 轮播图编辑表单弹窗 -->
        <div
          v-if="bannerFormOpen"
          class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="bannerFormOpen = false"
        >
          <div class="modal-surface max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div class="flex items-center justify-between">
              <h4 class="flex items-center gap-2 text-base font-bold">
                <AppIcon :name="bannerEditingId ? 'pen' : 'plus'" class="size-4 text-cyan-600 dark:text-cyan-400" />
                {{ bannerEditingId ? '编辑轮播项' : '新增轮播项' }}
              </h4>
              <button
                type="button"
                class="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                @click="bannerFormOpen = false"
              >
                <AppIcon name="x" class="size-5" />
              </button>
            </div>

            <form @submit.prevent="saveBanner">
              <!-- 基本信息 -->
              <div class="space-y-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">主标题</label>
                    <input
                      v-model="bannerForm.title"
                      type="text"
                      maxlength="80"
                      placeholder="主标题"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">分类类型</label>
                    <select
                      v-model="bannerForm.kind"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="blog">博客</option>
                      <option value="essay">随笔</option>
                      <option value="note">图文</option>
                      <option value="project">项目</option>
                      <option value="custom">推荐</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="mb-1 block text-xs text-slate-500">副标题</label>
                  <input
                    v-model="bannerForm.subtitle"
                    type="text"
                    maxlength="200"
                    placeholder="副标题"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-xs text-slate-500">描述文字</label>
                  <textarea
                    v-model="bannerForm.desc"
                    rows="2"
                    maxlength="300"
                    placeholder="描述文字（可选）"
                    class="w-full resize-none rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">跳转链接</label>
                    <input
                      v-model="bannerForm.to"
                      type="text"
                      maxlength="200"
                      placeholder="/posts 或 https://..."
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">排序（小的在前）</label>
                    <input
                      v-model.number="bannerForm.sort"
                      type="number"
                      min="0"
                      max="999"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <!-- 图片上传 -->
                <div>
                  <label class="mb-1 block text-xs text-slate-500">背景图片</label>
                  <div class="flex items-center gap-3">
                    <div class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                      <img
                        v-if="bannerForm.image"
                        :src="bannerForm.image"
                        class="h-full w-full object-cover"
                      />
                      <span v-else class="text-xs text-slate-400">无图</span>
                    </div>
                    <div class="flex-1">
                      <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                        <AppIcon name="upload" class="size-3.5" />
                        上传图片
                        <input type="file" accept="image/*" class="hidden" @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleBannerImageUpload(f); }" />
                      </label>
                      <p class="mt-1 text-xs text-slate-400">支持 jpg / png / webp / gif（gif 自動播放），≤ 5MB</p>
                    </div>
                  </div>
                </div>

                <!-- 视频背景（可选，存在时优先于图片） -->
                <div>
                  <label class="mb-1 block text-xs text-slate-500">背景视频 <span class="text-slate-400">（可选，优先级高于图片）</span></label>
                  <div class="flex items-center gap-3">
                    <div class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                      <video
                        v-if="bannerForm.video"
                        :src="bannerForm.video"
                        muted
                        loop
                        playsinline
                        class="h-full w-full object-cover"
                      />
                      <span v-else class="text-xs text-slate-400">无视频</span>
                    </div>
                    <div class="flex-1 space-y-1.5">
                      <div class="flex flex-wrap items-center gap-2">
                        <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                          <AppIcon name="upload" class="size-3.5" />
                          {{ bannerVideoUploading ? '上传中…' : '上传视频' }}
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            class="hidden"
                            :disabled="bannerVideoUploading"
                            @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleBannerVideoUpload(f); }"
                          />
                        </label>
                        <button
                          v-if="bannerForm.video"
                          type="button"
                          class="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20"
                          @click="bannerForm.video = ''"
                        >
                          <AppIcon name="x" class="size-3.5" />
                          移除视频
                        </button>
                      </div>
                      <p class="text-xs text-slate-400">支持 mp4 / webm / mov，≤ 50MB，移动端静音循环</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="mb-1 block text-xs text-slate-500">渐变背景（无图片和视频时显示）</label>
                  <input
                    v-model="bannerForm.gradient"
                    type="text"
                    maxlength="100"
                    placeholder="from-cyan-700 via-sky-800 to-blue-900"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
              </div>

              <!-- 文字显示开关 -->
              <div class="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold"><AppIcon name="sliders" class="size-4 text-cyan-600 dark:text-cyan-400" />文字显示开关</h4>
                <div class="flex flex-wrap gap-4">
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="bannerForm.showKind" class="accent-cyan-500" />
                    显示分类标签（博客/随笔/...）
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="bannerForm.showTitle" class="accent-cyan-500" />
                    显示主标题
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="bannerForm.showSubtitle" class="accent-cyan-500" />
                    显示副标题
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="bannerForm.showDesc" class="accent-cyan-500" />
                    显示描述文字
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="bannerForm.visible" class="accent-cyan-500" />
                    前台显示
                  </label>
                </div>
              </div>

              <!-- 主标题样式 -->
              <div class="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold"><AppIcon name="type" class="size-4 text-cyan-600 dark:text-cyan-400" />主标题样式</h4>
                <div class="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">字号 ({{ bannerForm.titleSize }}px)</label>
                    <input
                      v-model.number="bannerForm.titleSize"
                      type="range"
                      min="14"
                      max="120"
                      class="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">字重</label>
                    <select
                      v-model="bannerForm.titleWeight"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="normal">常规</option>
                      <option value="medium">中等</option>
                      <option value="semibold">半粗</option>
                      <option value="bold">粗体</option>
                      <option value="900">特粗</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">颜色</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="color"
                        v-model="bannerForm.titleColor"
                        class="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <input
                        v-model="bannerForm.titleColor"
                        type="text"
                        class="flex-1 rounded-lg border border-slate-300 bg-slate-50/80 px-2 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 副标题样式 -->
              <div class="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold"><AppIcon name="type" class="size-4 text-cyan-600 dark:text-cyan-400" />副标题样式</h4>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">字号 ({{ bannerForm.subtitleSize }}px)</label>
                    <input
                      v-model.number="bannerForm.subtitleSize"
                      type="range"
                      min="12"
                      max="48"
                      class="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">颜色</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="color"
                        :value="String(bannerForm.subtitleColor).replace(/^rgba?\([^)]+\)$/, '#ffffff')"
                        @input="(e) => (bannerForm.subtitleColor = (e.target as HTMLInputElement).value)"
                        class="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <input
                        v-model="bannerForm.subtitleColor"
                        type="text"
                        class="flex-1 rounded-lg border border-slate-300 bg-slate-50/80 px-2 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 描述文字样式 -->
              <div class="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold"><AppIcon name="align-left" class="size-4 text-cyan-600 dark:text-cyan-400" />描述文字样式</h4>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">字号 ({{ bannerForm.descSize }}px)</label>
                    <input
                      v-model.number="bannerForm.descSize"
                      type="range"
                      min="10"
                      max="36"
                      class="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">颜色</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="color"
                        :value="String(bannerForm.descColor).replace(/^rgba?\([^)]+\)$/, '#ffffff')"
                        @input="(e) => (bannerForm.descColor = (e.target as HTMLInputElement).value)"
                        class="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <input
                        v-model="bannerForm.descColor"
                        type="text"
                        class="flex-1 rounded-lg border border-slate-300 bg-slate-50/80 px-2 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 位置控制 -->
              <div class="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold"><AppIcon name="move" class="size-4 text-cyan-600 dark:text-cyan-400" />位置控制</h4>
                <div class="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">水平位置</label>
                    <select
                      v-model="bannerForm.textPosition"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                      <option value="right">右对齐</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">文字对齐</label>
                    <select
                      v-model="bannerForm.textAlign"
                      class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                      <option value="right">右对齐</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-slate-500">垂直偏移 ({{ bannerForm.textOffsetY }}vh)</label>
                    <input
                      v-model.number="bannerForm.textOffsetY"
                      type="range"
                      min="-30"
                      max="30"
                      class="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <p v-if="bannerErr" class="mt-4 text-xs text-red-500">{{ bannerErr }}</p>

              <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="bannerFormOpen = false">
                  <AppIcon name="close" class="size-3.5" />
                  取消
                </button>
                <button type="submit" class="btn-primary !px-4 !py-2 text-xs" :disabled="bannerLoading">
                  <AppIcon name="check" class="size-3.5" />
                  {{ bannerLoading ? '保存中...' : '保存' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <!-- ===== 资料设置 ===== -->
      <section v-if="tab === 'profile'">
        <h2 class="mb-4 font-semibold">个人资料</h2>
        <div class="glass rounded-3xl p-6 md:p-8">
          <!-- 头像上传 -->
          <div class="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/40">
            <div
              class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-bold text-white shadow-lg shadow-cyan-500/30"
            >
              <img
                v-if="pf.avatar"
                :src="pf.avatar"
                alt="头像预览"
                class="size-full object-cover"
              />
              <span v-else>{{ pf.avatarText || '序' }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium">头像</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                建议 200×200 方形图片，≤2MB。上传后保存资料才会生效。
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <label class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:text-slate-300 dark:hover:text-cyan-400">
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleAvatarUpload(f); }"
                  />
                  <AppIcon name="upload" class="size-4" />
                  {{ pf.avatar ? '更换头像' : '上传头像' }}
                </label>
                <button
                  v-if="pf.avatar"
                  type="button"
                  class="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
                  @click="pf.avatar = ''"
                >
                  <AppIcon name="trash" class="size-3.5" />
                  移除头像
                </button>
              </div>
            </div>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium">姓名 *</label>
              <input v-model="pf.name" type="text" class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium">职位</label>
              <input v-model="pf.title" type="text" class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium">坐标</label>
              <input v-model="pf.location" type="text" class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium">邮箱</label>
              <input v-model="pf.email" type="email" class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
            </div>
          </div>

          <div class="mt-5">
            <label class="mb-1.5 block text-sm font-medium">个人简介（每行一段）</label>
            <textarea v-model="pf.bio" rows="4" class="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>

          <div class="mt-5">
            <label class="mb-1.5 block text-sm font-medium">打字机标语（每行一句）</label>
            <textarea v-model="pf.tagline" rows="3" class="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>

          <div class="mt-5">
            <label class="mb-1.5 block text-sm font-medium">兴趣爱好（逗号分隔）</label>
            <input v-model="pf.hobbies" type="text" class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>

          <div class="mt-5">
            <label class="mb-1.5 block text-sm font-medium">社交链接（每行：名称=网址）</label>
            <textarea v-model="pf.socials" rows="3" placeholder="GitHub=https://github.com/you" class="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 font-mono text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>

          <div class="mt-5">
            <label class="mb-1.5 block text-sm font-medium">数据统计（每行：标签=数值）</label>
            <textarea v-model="pf.stats" rows="3" placeholder="年开发经验=5+" class="w-full resize-y rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 font-mono text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>

          <div class="mt-8 flex justify-end">
            <button type="button" class="btn-primary" @click="saveProfile">
              <AppIcon name="check" class="size-4" />
              保存资料
            </button>
          </div>
        </div>
      </section>

      <!-- ===== 导航栏配置 ===== -->
      <section v-if="tab === 'navbar'">
        <h2 class="mb-1 font-semibold">导航栏配置</h2>
        <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
          左侧 Logo · 中间导航（居中） · 右侧搜索 + 联系。建议文字精简为文艺单字。修改后刷新前台即可生效。
        </p>

        <div
          class="glass rounded-2xl p-5"
        >
          <div v-if="!navDraft.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            还没有导航项，点击下方「+ 新增」添加
          </div>

          <div v-else class="space-y-2.5">
            <div
              v-for="(item, i) in navDraft"
              :key="i"
              class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 p-2.5 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <!-- 排序箭头 -->
              <div class="flex flex-col gap-0.5">
                <button
                  type="button"
                  :disabled="i === 0"
                  class="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-700"
                  @click="navMove(i, -1)"
                >
                  <AppIcon name="chevron-up" class="size-3" />
                </button>
                <button
                  type="button"
                  :disabled="i === navDraft.length - 1"
                  class="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-700"
                  @click="navMove(i, 1)"
                >
                  <AppIcon name="chevron-down" class="size-3" />
                </button>
              </div>

              <!-- 预览序号 -->
              <span class="w-6 text-center text-xs font-mono text-slate-400">{{ i + 1 }}</span>

              <!-- 图标 -->
              <label class="group relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-600">
                <img v-if="item.icon" :src="item.icon" class="size-full object-cover" />
                <AppIcon v-else name="image" class="size-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="(e) => handleNavIconUpload(i, (e.target as HTMLInputElement).files?.[0])"
                />
                <span
                  v-if="item.icon"
                  class="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  换图
                </span>
              </label>
              <button
                v-if="item.icon"
                type="button"
                class="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400 hover:text-red-500"
                @click="item.icon = ''"
                title="清除图标"
              >
                <AppIcon name="x" class="size-3" />
                清除
              </button>

              <!-- 标签 / 文字 -->
              <input
                v-model="item.label"
                type="text"
                maxlength="10"
                placeholder="文字"
                class="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />

              <!-- 预览 -->
              <span class="text-xs text-slate-400">→</span>

              <!-- 路由 / 地址 -->
              <input
                v-model="item.to"
                type="text"
                maxlength="100"
                placeholder="/ 或 https://..."
                class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />

              <!-- 显示/隐藏 -->
              <ToggleSwitch
                :model-value="!item.hidden"
                class="shrink-0 scale-75"
                @update:model-value="(v) => (item.hidden = !v)"
              />

              <!-- 删 -->
              <button
                type="button"
                class="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                @click="navRemove(i)"
                title="删除"
              >
                <AppIcon name="x" class="size-4" />
              </button>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="navAdd">
              <AppIcon name="plus" class="size-3.5" />
              新增一项
            </button>
            <div class="flex gap-2">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="loadNavDraft">
                <AppIcon name="refresh-cw" class="size-3.5" />
                重置
              </button>
              <button type="button" class="btn-primary !px-5 !py-2 text-xs" @click="saveNavDraft">
                <AppIcon name="check" class="size-3.5" />
                保存导航栏
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 站点设置 ===== -->
      <section v-if="tab === 'settings'">
        <h2 class="mb-4 font-semibold">站点设置</h2>
        <div class="space-y-5">
          <!-- 云雾特效按钮 -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">云雾特效按钮</p>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">开启后全站按钮变为 WebGL 液态玻璃胶囊</p>
              </div>
              <ToggleSwitch
                :model-value="fancyButtons"
                :disabled="settingsSaving"
                @update:model-value="toggleSetting('fancyButtons')"
              />
            </div>
          </div>

          <!-- ===== 点击效果 ===== -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <AppIcon name="sparkle" class="size-4" :style="{ color: 'var(--accent-1)' }" />
                <p class="font-semibold">点击页面效果</p>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="text-xs font-medium" :class="clickEffectEnabled ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'">
                  {{ clickEffectEnabled ? '已开启' : '已关闭' }}
                </span>
                <ToggleSwitch
                  :model-value="clickEffectEnabled"
                  @update:model-value="toggleClickEffect(!clickEffectEnabled)"
                />
              </div>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              点击页面任意位置触发的粒子动画，可调节形态、大小与灯光
            </p>
            <!-- 关闭时的提示 -->
            <div
              v-if="!clickEffectEnabled"
              class="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <AppIcon name="alert-circle" class="mt-px size-3.5 shrink-0" />
              <span>当前已关闭，前台点击不会出现粒子。下方参数会保留，重新开启即恢复原样。</span>
            </div>

            <!-- 参数区：关闭时置灰且禁用交互 -->
            <div
              class="transition-opacity duration-200"
              :class="clickEffectEnabled ? 'opacity-100' : 'pointer-events-none opacity-45'"
              :aria-disabled="!clickEffectEnabled"
            >
            <!-- 形态：卡片选择 -->
            <div class="mt-4">
              <label class="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <AppIcon name="wand" class="size-3.5" />
                粒子形态
              </label>
              <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <button
                  v-for="opt in CLICK_EFFECT_OPTIONS"
                  :key="opt.value"
                  type="button"
                  :disabled="settingsSaving"
                  :title="opt.desc"
                  class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50"
                  :class="
                    clickEffect === opt.value
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
                  "
                  :style="
                    clickEffect === opt.value
                      ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }
                      : undefined
                  "
                  @click="setClickEffect(opt.value)"
                >
                  <AppIcon :name="opt.icon" class="size-4 shrink-0" />
                  <span class="min-w-0">
                    <span class="block truncate text-xs font-medium">{{ opt.label }}</span>
                    <span class="block truncate text-[10px] opacity-70">{{ opt.desc }}</span>
                  </span>
                </button>
              </div>
            </div>

            <!-- 自定义图片上传 -->
            <div v-if="clickEffect === 'custom'" class="mt-3">
              <label class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:text-slate-300 dark:hover:text-cyan-400">
                <input type="file" accept="image/*" class="hidden" :disabled="settingsSaving"
                  @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleClickImageUpload(f); }" />
                <AppIcon name="upload" class="size-4" />
                {{ customClickImage ? '更换图片（≤2MB）' : '上传图片（建议 64×64px，≤2MB）' }}
              </label>
              <div v-if="customClickImage" class="mt-2 flex items-center gap-2">
                <img :src="customClickImage" alt="预览" class="h-8 w-8 rounded border border-slate-200 object-contain dark:border-slate-600" />
                <button type="button" class="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600" :disabled="settingsSaving"
                  @click="updateSettings({ customClickImage: '', clickEffect: 'hearts' })">
                  <AppIcon name="trash" class="size-3.5" />
                  移除
                </button>
              </div>
            </div>

            <div class="my-4 border-t border-slate-200 dark:border-slate-700" />

            <!-- 粒子大小 -->
            <div>
              <div class="flex items-center justify-between text-xs">
                <label class="inline-flex items-center gap-1.5 font-medium">
                  <AppIcon name="maximize" class="size-3.5" />
                  粒子大小
                </label>
                <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ clickEffectSize.toFixed(2) }}×</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3"
                step="0.05"
                :value="clickEffectSize"
                class="mt-2 w-full accent-[rgb(var(--accent-1-rgb))]"
                :disabled="settingsSaving"
                @input="(e) => { clickEffectSize = Number((e.target as HTMLInputElement).value); }"
                @change="(e) => saveClickOption({ clickEffectSize: Number((e.target as HTMLInputElement).value) })"
              />
              <div class="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>0.4× {{ $t('admin.effectSizeFine') }}</span><span>1× {{ $t('admin.effectSizeDefault') }}</span><span>3× {{ $t('admin.effectSizeExaggerated') }}</span>
              </div>
            </div>

            <!-- 灯光样式 -->
            <div class="mt-5">
              <label class="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <AppIcon name="lightbulb" class="size-3.5" />
                灯光样式
              </label>
              <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <button
                  v-for="g in GLOW_OPTIONS"
                  :key="g.value"
                  type="button"
                  :disabled="settingsSaving"
                  :title="g.desc"
                  class="rounded-xl border px-3 py-2 text-left transition-all disabled:opacity-50"
                  :class="
                    clickEffectGlow === g.value
                      ? 'border-transparent ring-2 ring-[rgb(var(--accent-1-rgb))]'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
                  "
                  @click="saveClickOption({ clickEffectGlow: g.value }, '灯光样式已更新')"
                >
                  <span class="flex items-center gap-1.5">
                    <span
                      class="size-3 shrink-0 rounded-full"
                      :style="{
                        background: 'rgb(var(--accent-1-rgb))',
                        boxShadow:
                          g.value === 'none' ? 'none'
                          : g.value === 'soft' ? '0 0 4px rgba(var(--accent-1-rgb), .6)'
                          : g.value === 'strong' ? '0 0 8px rgba(var(--accent-1-rgb), .9)'
                          : '0 0 6px rgba(var(--accent-1-rgb), 1), 0 0 14px rgba(var(--accent-1-rgb), .7)',
                      }"
                    />
                    <span class="text-xs font-medium">{{ g.label }}</span>
                    <AppIcon
                      v-if="clickEffectGlow === g.value"
                      name="check"
                      class="ml-auto size-3"
                      :style="{ color: 'rgb(var(--accent-1-rgb))' }"
                    />
                  </span>
                  <span class="mt-0.5 block text-[10px] text-slate-400">{{ g.desc }}</span>
                </button>
              </div>
            </div>

            <!-- 发光强度（选「无发光」时隐藏，因为无意义） -->
            <div v-if="clickEffectGlow !== 'none'" class="mt-4">
              <div class="flex items-center justify-between text-xs">
                <label class="inline-flex items-center gap-1.5 font-medium">
                  <AppIcon name="sun" class="size-3.5" />
                  发光强度
                </label>
                <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ clickEffectGlowIntensity }}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                :value="clickEffectGlowIntensity"
                class="mt-2 w-full accent-[rgb(var(--accent-1-rgb))]"
                :disabled="settingsSaving"
                @input="(e) => { clickEffectGlowIntensity = Number((e.target as HTMLInputElement).value); }"
                @change="(e) => saveClickOption({ clickEffectGlowIntensity: Number((e.target as HTMLInputElement).value) })"
              />
              <div class="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>{{ $t('admin.glowSoft') }}</span><span>{{ $t('admin.glowStrong') }}</span>
              </div>
            </div>

            <!-- 多彩 -->
            <div class="mt-5 flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-xs font-medium">
                  <AppIcon name="palette" class="size-3.5" />
                  多彩配色
                </p>
                <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {{ clickEffectMulticolor ? '随机彩虹色，活泼' : '仅用站点主题色，统一克制' }}
                </p>
              </div>
              <ToggleSwitch
                :model-value="clickEffectMulticolor"
                :disabled="settingsSaving"
                @update:model-value="(v) => saveClickOption({ clickEffectMulticolor: v }, '配色已更新')"
              />
            </div>
            </div>
            <!-- /参数区 -->
          </div>

          <!-- ===== 音乐播放器配置 ===== -->
          <div class="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <p class="mb-4 font-semibold">音乐播放器</p>

            <div class="space-y-4">
              <!-- 开关 -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">启用音乐播放器</p>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">开启后页面右侧靠壁显示音乐悬浮球（admin 页面自动隐藏）</p>
                </div>
                <ToggleSwitch
                  :model-value="musicEnabled"
                  :disabled="settingsSaving"
                  @update:model-value="toggleSetting('musicEnabled')"
                />
              </div>

              <div class="border-t border-slate-200 dark:border-slate-700" />

              <!-- 皮肤选择 -->
              <div>
                <p class="font-medium">播放器皮肤</p>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  面板展开时的视觉风格，共 {{ MUSIC_SKINS.length }} 款内置 + 自定义图片
                </p>
                <div class="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  <button
                    v-for="sk in MUSIC_SKINS"
                    :key="sk.key"
                    type="button"
                    :disabled="settingsSaving"
                    :title="sk.desc"
                    class="group overflow-hidden rounded-xl border text-left transition-all disabled:opacity-50"
                    :class="
                      musicSkin === sk.key
                        ? 'border-transparent ring-2 ring-[rgb(var(--accent-1-rgb))]'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
                    "
                    @click="updateSettings({ musicSkin: sk.key } as any)"
                  >
                    <!-- 缩略预览 -->
                    <span
                      class="relative flex h-16 w-full items-end justify-between gap-1 p-2"
                      :style="{
                        ...sk.preview,
                        ...(sk.isImage && musicSkinBg
                          ? { backgroundImage: `url(${musicSkinBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : {}),
                      }"
                    >
                      <!-- 模拟面板元素 -->
                      <span class="flex flex-col gap-1">
                        <span class="block h-1.5 w-8 rounded-full bg-current opacity-35" />
                        <span class="block h-1.5 w-12 rounded-full bg-current opacity-25" />
                      </span>
                      <span
                        class="grid size-4 shrink-0 place-items-center rounded-full text-[8px]"
                        :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
                      >
                        <span class="text-white">&#9654;</span>
                      </span>
                      <!-- 选中角标 -->
                      <span
                        v-if="musicSkin === sk.key"
                        class="absolute right-1 top-1 grid size-4 place-items-center rounded-full text-white"
                        :style="{ background: 'rgb(var(--accent-1-rgb))' }"
                      >
                        <AppIcon name="check" class="size-2.5" />
                      </span>
                    </span>
                    <span class="block bg-white px-2 py-1.5 dark:bg-slate-800">
                      <span class="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">{{ sk.label }}</span>
                    </span>
                  </button>
                </div>
              </div>

              <!-- 自定义皮肤：上传图片 + 调节 -->
              <div v-if="musicSkin === 'custom'" class="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
                <label class="mb-1.5 block font-medium">自定义背景图片</label>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">上传一张图片作为音乐面板的背景（≤2MB，建议 600×900 以上竖图）</p>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <label class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:text-slate-300 dark:hover:text-cyan-400">
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      :disabled="settingsSaving"
                      @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleMusicSkinUpload(f); }"
                    />
                    <AppIcon name="upload" class="size-4" />
                    {{ musicSkinBg ? '更换图片' : '上传图片' }}
                  </label>
                  <div v-if="musicSkinBg" class="flex items-center gap-2">
                    <img :src="musicSkinBg" alt="皮肤预览" class="h-12 w-16 rounded border border-slate-200 object-cover dark:border-slate-600" />
                    <button type="button" class="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600" :disabled="settingsSaving"
                      @click="updateSettings({ musicSkinBg: '' })">
                      <AppIcon name="trash" class="size-3.5" />
                      移除
                    </button>
                  </div>
                </div>

                <!-- 蒙层不透明度 -->
                <div class="mt-4">
                  <div class="flex items-center justify-between text-xs">
                    <label class="inline-flex items-center gap-1.5 font-medium">
                      <AppIcon name="eye" class="size-3.5" />
                      蒙层不透明度
                    </label>
                    <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ musicSkinOpacity }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="musicSkinOpacity"
                    class="mt-2 w-full accent-[rgb(var(--accent-1-rgb))]"
                    :disabled="settingsSaving"
                    @change="updateSettings({ musicSkinOpacity: Number(($event.target as HTMLInputElement).value) })"
                  />
                  <p class="mt-1 text-[11px] text-slate-400">越低越透出图片，越高文字越清晰</p>
                </div>

                <!-- 面板模糊度 -->
                <div class="mt-4">
                  <div class="flex items-center justify-between text-xs">
                    <label class="inline-flex items-center gap-1.5 font-medium">
                      <AppIcon name="sparkle" class="size-3.5" />
                      面板模糊度
                    </label>
                    <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ musicSkinBlur }}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    :value="musicSkinBlur"
                    class="mt-2 w-full accent-[rgb(var(--accent-1-rgb))]"
                    :disabled="settingsSaving"
                    @change="updateSettings({ musicSkinBlur: Number(($event.target as HTMLInputElement).value) })"
                  />
                  <p class="mt-1 text-[11px] text-slate-400">毛玻璃程度，0 为完全清晰</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 背景效果選擇 -->
          <div class="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/40">
            <p class="font-medium">背景效果</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              選擇網站全局動態背景，顏色跟隨主題。預覽需保存後刷新前台查看。
            </p>
            <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              <button
                v-for="bg in [
                  { key: 'none', label: '無背景' },
                  { key: 'aurora', label: '極光' },
                  { key: 'blackhole', label: '黑洞' },
                  { key: 'bubbles', label: '氣泡' },
                  { key: 'cosmic-portal', label: '宇宙門' },
                  { key: 'falling-stars', label: '流星' },
                  { key: 'flickering-grid', label: '閃爍網格' },
                  { key: 'interactive-grid', label: '互動網格' },
                  { key: 'lamp', label: '燈光' },
                  { key: 'neural', label: '神經網絡' },
                  { key: 'pattern', label: '圖案' },
                  { key: 'ribbon', label: '絲帶' },
                  { key: 'silk', label: '絲綢' },
                  { key: 'snowfall', label: '雪花' },
                  { key: 'tetris', label: '方塊' },
                  { key: 'video-text', label: '視頻文字' },
                  { key: 'thunderstorm', label: '雷暴' },
                  { key: 'wavy', label: '波浪' },
                ]"
                :key="bg.key"
                type="button"
                :disabled="settingsSaving"
                class="rounded-lg border px-2 py-2.5 text-xs font-medium transition-all"
                :class="
                  backgroundType === bg.key
                    ? 'border-transparent text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-cyan-400'
                "
                :style="backgroundType === bg.key ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' } : {}"
                @click="updateSettings({ backgroundType: bg.key } as any)"
              >
                {{ bg.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 看板娘設置 -->
        <div class="glass mt-6 rounded-3xl p-6 md:p-8">
          <h3 class="mb-1 flex items-center gap-2 font-semibold">
            <span
              class="grid size-7 place-items-center rounded-lg text-white"
              style="background: linear-gradient(135deg, var(--accent-1), var(--accent-2));"
            >
              <AppIcon name="heart" class="size-4" />
            </span>
            看板娘
          </h3>
          <p class="mb-5 text-xs text-slate-500 dark:text-slate-400">
            網頁右下角的可愛陪伴角色。可自定義造型、待機動畫與她會說的話。
          </p>

          <!-- 啟用開關 -->
          <div class="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div>
              <div class="text-sm font-medium">啟用看板娘</div>
              <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">關閉後前台頁面不再顯示</div>
            </div>
            <ToggleSwitch
              :model-value="companionEnabled"
              @update:model-value="updateSettings({ companionEnabled: !companionEnabled } as any)"
            />
          </div>

          <!-- 造型選擇 -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium">角色造型</label>
            <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
              内置 {{ COMPANION_SKINS.length }} 款精细矢量化身，发色 / 服饰 / 耳朵均按造型独立绘制。
            </p>
            <div class="flex flex-wrap gap-2.5">
              <button
                v-for="sk in COMPANION_SKINS"
                :key="sk.key"
                type="button"
                class="group w-[104px] rounded-2xl border p-2 text-center transition-all"
                :class="
                  companionSkin === sk.key
                    ? 'border-transparent shadow-md ring-2'
                    : 'border-slate-200 bg-white hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800'
                "
                :style="
                  companionSkin === sk.key
                    ? { '--tw-ring-color': `rgb(var(--accent-1-rgb))` }
                    : {}
                "
                @click="updateSettings({ companionSkin: sk.key } as any)"
              >
                <!-- 迷你造型預覽：用同一套 CSS 变量画一个头 -->
                <span
                  class="mx-auto mb-1.5 grid h-14 w-14 place-items-center overflow-hidden rounded-xl"
                  :style="{ background: companionSkin === sk.key ? 'linear-gradient(135deg, rgba(var(--accent-1-rgb),.14), rgba(var(--accent-2-rgb),.14))' : 'rgba(148,163,184,.12)' }"
                >
                  <svg viewBox="0 0 40 40" class="size-11" aria-hidden="true">
                    <!-- 耳朵 -->
                    <template v-if="sk.key === 'cat' || sk.key === 'fox'">
                      <path d="M10 13 L9 4 L16 10 Z" :fill="sk.hair" />
                      <path d="M30 13 L31 4 L24 10 Z" :fill="sk.hair" />
                    </template>
                    <template v-else-if="sk.key === 'bunny'">
                      <ellipse cx="15" cy="9" rx="3.4" ry="9" :fill="sk.hair" />
                      <ellipse cx="25" cy="9" rx="3.4" ry="9" :fill="sk.hair" />
                      <ellipse cx="15" cy="9" rx="1.6" ry="5.5" :fill="sk.earInner" />
                      <ellipse cx="25" cy="9" rx="1.6" ry="5.5" :fill="sk.earInner" />
                    </template>
                    <template v-else-if="sk.key === 'bear' || sk.key === 'panda'">
                      <circle cx="11" cy="12" r="4.6" :fill="sk.hair" />
                      <circle cx="29" cy="12" r="4.6" :fill="sk.hair" />
                      <circle cx="11" cy="12" r="2.1" :fill="sk.earInner" />
                      <circle cx="29" cy="12" r="2.1" :fill="sk.earInner" />
                    </template>
                    <template v-else>
                      <ellipse cx="8.5" cy="21" rx="2" ry="2.8" :fill="sk.skin" />
                      <ellipse cx="31.5" cy="21" rx="2" ry="2.8" :fill="sk.skin" />
                    </template>
                    <!-- 後髮 -->
                    <path d="M6 21 C6 9 12 3 20 3 C28 3 34 9 34 21 C34 27 32 31 29 33 C30 27 29 22 27 19 C23 16 17 16 13 19 C11 22 10 27 11 33 C8 31 6 27 6 21 Z" :fill="sk.hairShade" />
                    <!-- 臉 -->
                    <ellipse cx="20" cy="21.5" rx="11.5" ry="12" :fill="sk.skin" />
                    <!-- 前髮 -->
                    <path d="M8.5 19 C8 10.5 13 5 20 5 C27 5 32 10.5 31.5 19 C30.5 14 28 10.5 25.5 8.5 C24 12.5 21 15 17.5 15.5 C20 12.5 21.5 9.5 22 6.5 C18 10.5 13 12.5 8.5 19 Z" :fill="sk.hair" />
                    <!-- 眼睛 -->
                    <ellipse cx="15.5" cy="21.5" rx="2.3" ry="2.8" :fill="sk.eye" />
                    <ellipse cx="24.5" cy="21.5" rx="2.3" ry="2.8" :fill="sk.eye" />
                    <circle cx="14.7" cy="20.5" r="0.9" fill="#fff" opacity="0.95" />
                    <circle cx="23.7" cy="20.5" r="0.9" fill="#fff" opacity="0.95" />
                    <!-- 腮紅 -->
                    <ellipse cx="12.5" cy="26" rx="2.7" ry="1.7" :fill="sk.blush" opacity="0.55" />
                    <ellipse cx="27.5" cy="26" rx="2.7" ry="1.7" :fill="sk.blush" opacity="0.55" />
                    <!-- 鼻子（走獸） -->
                    <path v-if="sk.key !== 'default'" d="M18.7 25 C19.2 24 20.8 24 21.3 25 C20.8 26.2 19.2 26.2 18.7 25 Z" :fill="sk.earInner" />
                  </svg>
                </span>
                <span class="block text-xs font-medium text-slate-700 dark:text-slate-200">{{ sk.label }}</span>
                <span v-if="sk.followsTheme" class="block text-[10px] text-slate-400">跟随主题</span>
              </button>
            </div>
            <!-- 当前造型说明 -->
            <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">{{ getCompanionSkin(companionSkin).desc }}</p>
          </div>

          <!-- 图片型造型 -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium">图片造型</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="sk in ([
                  { key: 'avatar', label: '个人头像', icon: 'user' },
                  { key: 'custom', label: '自定义图片', icon: 'image' },
                ] as const)"
                :key="sk.key"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all"
                :class="
                  companionSkin === sk.key
                    ? 'border-transparent text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                "
                :style="companionSkin === sk.key ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' } : {}"
                @click="updateSettings({ companionSkin: sk.key } as any)"
              >
                <AppIcon :name="sk.icon" class="size-3.5" />
                <span>{{ sk.label }}</span>
              </button>
            </div>
          </div>

          <!-- 自定義圖片 -->
          <div v-if="companionSkin === 'custom'" class="mb-6 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
            <label class="mb-2 block text-sm font-medium">自定義圖片（≤2MB）</label>
            <div class="flex items-center gap-4">
              <div
                class="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
              >
                <img
                  v-if="companionCustomImage"
                  :src="companionCustomImage"
                  alt="自定義看板娘"
                  class="h-full w-full object-contain"
                />
                <span v-else class="text-xs text-slate-400">預覽</span>
              </div>
              <div class="flex-1 space-y-2">
                <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r px-3 py-1.5 text-sm font-medium text-white shadow-sm" style="background: linear-gradient(135deg, var(--accent-1), var(--accent-2));">
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleCompanionImageUpload(f); (e.target as HTMLInputElement).value = ''; }"
                  />
                  上傳圖片
                </label>
                <button
                  v-if="companionCustomImage"
                  type="button"
                  class="ml-2 inline-flex items-center gap-1 text-xs text-rose-500 hover:underline"
                  @click="clearCompanionImage"
                >
                  <AppIcon name="refresh-cw" class="size-3.5" />
                  清除並恢復預設
                </button>
              </div>
            </div>
          </div>

          <!-- 待機動畫 -->
          <div class="mb-6">
            <label class="mb-2 block text-sm font-medium">待機動畫</label>
            <div class="flex flex-wrap gap-2">
              <template v-for="anim in ([
                { key: 'bob', label: '上下浮動' },
                { key: 'sway', label: '左右輕擺' },
                { key: 'breathe', label: '呼吸縮放' },
                { key: 'none', label: '無動畫' },
                { key: 'custom', label: '自定義動圖' },
              ] as const)" :key="anim.key">
                <button
                  type="button"
                  class="rounded-lg border px-3 py-1.5 text-sm transition-all"
                  :class="
                    companionIdleAnim === anim.key
                      ? 'border-transparent text-white shadow-md'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  "
                  :style="companionIdleAnim === anim.key ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' } : {}"
                  @click="updateSettings({ companionIdleAnim: anim.key } as any)"
                >
                  {{ anim.label }}
                </button>
              </template>
            </div>

            <!-- 自定義動圖上傳區 -->
            <div
              v-if="companionIdleAnim === 'custom'"
              class="mt-3 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-600"
            >
              <div class="flex items-center gap-4">
                <div
                  class="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                >
                  <img
                    v-if="companionIdleAnimImage"
                    :src="companionIdleAnimImage"
                    alt="自定義待機動圖預覽"
                    class="h-full w-full object-contain"
                  />
                  <span v-else class="text-xs text-slate-400">預覽</span>
                </div>
                <div class="flex-1 space-y-2">
                  <label
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                    style="background: linear-gradient(135deg, var(--accent-1), var(--accent-2));"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleCompanionIdleImageUpload(f); (e.target as HTMLInputElement).value = ''; }"
                    />
                    上傳動圖
                  </label>
                  <button
                    v-if="companionIdleAnimImage"
                    type="button"
                    class="ml-2 inline-flex items-center gap-1 text-xs text-rose-500 hover:underline"
                    @click="clearCompanionIdleImage"
                  >
                    <AppIcon name="refresh-cw" class="size-3.5" />
                    清除並恢復預設
                  </button>
                  <p class="mt-1 text-xs text-slate-400">支援 GIF / APNG / WebP 動圖，最大 8MB</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 自定義語氣泡 -->
          <div>
            <label class="mb-2 block text-sm font-medium">自定義語氣泡內容</label>
            <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">每行一條，最多 30 條。留空則使用內置對話。</p>
            <textarea
              ref="companionSaysInput"
              rows="4"
              class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              :value="companionSays.join('\n')"
              placeholder="今天也要開心哦～&#10;摸摸頭 🐾"
            />
            <div class="mt-2 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r px-4 py-1.5 text-sm font-medium text-white shadow-sm"
                style="background: linear-gradient(135deg, var(--accent-1), var(--accent-2));"
                @click="saveCompanionSays($refs.companionSaysInput as HTMLTextAreaElement)"
              >
                <AppIcon name="check" class="size-4" />
                保存語氣泡
              </button>
            </div>
          </div>
        </div>

        <!-- 語言設置 -->
        <div class="glass rounded-3xl p-6 md:p-8">
          <h3 class="mb-1 flex items-center gap-2 font-semibold">
            <AppIcon name="globe" class="size-5" />
            站點語言
          </h3>
          <p class="mb-5 text-xs text-slate-500 dark:text-slate-400">
            選擇網站顯示語言，所有頁面即時生效。
          </p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              v-for="l in languageOptions"
              :key="l.key"
              type="button"
              class="group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-md"
              :class="
                siteLanguage === l.key
                  ? 'border-transparent text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              "
              :style="
                siteLanguage === l.key
                  ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }
                  : {}
              "
              @click="changeLanguage(l.key)"
            >
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-xl dark:bg-slate-700">
                {{ l.flag }}
              </span>
              <span class="flex-1">
                <span class="block text-sm font-medium">{{ l.label }}</span>
                <span class="mt-0.5 block truncate text-[11px] text-slate-400">
                  {{ l.key }}
                </span>
              </span>
              <svg
                v-if="siteLanguage === l.key"
                class="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 字體設置 -->
        <div class="glass rounded-3xl p-6 md:p-8">
          <h3 class="mb-1 flex items-center gap-2 font-semibold">
            <span class="text-lg">🔤</span> 站點字體
          </h3>
          <p class="mb-5 text-xs text-slate-500 dark:text-slate-400">
            網站所有頁面（代碼塊等寬字體除外）的字體，選擇後即時生效。
          </p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="f in FONT_PRESETS"
              :key="f.key"
              type="button"
              class="group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-md"
              :class="
                siteFont === f.key
                  ? 'border-transparent text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              "
              :style="
                siteFont === f.key
                  ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }
                  : {}
              "
              @click="updateSettings({ siteFont: f.key } as any)"
            >
              <!-- 字體預覽（用 font-family 即時預覽） -->
              <span
                class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-xl dark:bg-slate-700"
                :style="{ fontFamily: f.family }"
              >
                Aa
              </span>
              <span class="flex-1">
                <span class="block text-sm font-medium" :style="{ fontFamily: f.family }">
                  {{ f.label }}
                </span>
                <span class="mt-0.5 block truncate text-[11px] text-slate-400">
                  {{ f.googleName || '純系統字體' }}
                </span>
              </span>
              <svg
                v-if="siteFont === f.key"
                class="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>

          <div class="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            💡 提示：前 7 款為藝術中文書法 / 手寫字體，選擇後全站即時生效；Google Fonts 字體需聯網加載，首次載入後由瀏覽器緩存。
          </div>
        </div>
      </section>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl dark:bg-slate-100 dark:text-slate-900"
      >
        {{ toast }}
      </div>
    </Transition>

    <!-- 编辑器弹窗 -->
    <PostEditor
      v-if="postEditor.open"
      :post="postEditor.post"
      @save="savePost"
      @cancel="postEditor = { open: false, post: null }"
    />
    <ProjectEditor
      v-if="projectEditor.open"
      :project="projectEditor.project"
      @save="saveProject"
      @cancel="projectEditor = { open: false, project: null }"
    />

    <!-- 相册分类编辑弹窗 -->
    <Transition name="fade">
      <div
        v-if="albumFormOpen"
        class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="albumFormOpen = false"
      >
        <div class="modal-surface w-full max-w-md rounded-2xl p-6 shadow-2xl">
          <h3 class="mb-4 flex items-center gap-2 border-b border-slate-200/70 pb-4 text-lg font-semibold text-slate-900 dark:border-slate-700/60 dark:text-white">
            <AppIcon :name="albumEditingCat ? 'pen' : 'plus'" class="size-5 text-cyan-600 dark:text-cyan-400" />
            {{ albumEditingCat ? '编辑相册分类' : '新建相册分类' }}
          </h3>
          <form class="space-y-4" @submit.prevent="saveAlbumCategory">
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">标题 *</label>
              <input
                v-model="albumForm.title"
                required
                maxlength="40"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="例如：旅行、美食、日常"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">描述</label>
              <textarea
                v-model="albumForm.desc"
                maxlength="120"
                rows="2"
                class="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="可选"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">封面</label>
              <div v-if="albumForm.cover" class="relative mb-2 h-24 w-full overflow-hidden rounded-lg">
                <img :src="albumForm.cover" class="h-full w-full object-cover" />
                <button
                  type="button"
                  class="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white transition-colors hover:bg-black/80"
                  @click="albumForm.cover = ''"
                >
                  <AppIcon name="x" class="size-3" />
                  移除
                </button>
              </div>
              <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-600 dark:text-slate-400">
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleAlbumCoverUpload"
                />
                <AppIcon name="upload" class="size-3.5" />
                上传封面图片（≤2MB）
              </label>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">排序</label>
              <input
                v-model.number="albumForm.sort"
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <!-- 密码设置 -->
            <div class="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                  分類密碼（可選）
                </label>
                <div v-if="albumEditingCat?.hasPassword" class="text-xs text-amber-500">
                  🔒 已設置密碼
                </div>
              </div>
              <div v-if="albumEditingCat?.hasPassword" class="mb-1 flex items-center gap-2">
                <input
                  v-model="albumForm.clearPassword"
                  type="checkbox"
                  id="clearPwd"
                  class="h-3.5 w-3.5 rounded border-slate-300 accent-cyan-500 dark:border-slate-500"
                />
                <label for="clearPwd" class="text-xs text-slate-500 dark:text-slate-400">清除密碼保護</label>
              </div>
              <input
                v-model="albumForm.password"
                type="password"
                :disabled="albumForm.clearPassword"
                maxlength="64"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                :placeholder="albumEditingCat ? '留空則保持原密碼不變' : '為該分類設置獨立密碼（可選）'"
              />
              <input
                v-model="albumForm.passwordConfirm"
                type="password"
                :disabled="albumForm.clearPassword || !albumForm.password"
                maxlength="64"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="再次輸入密碼確認"
              />
            </div>
            <div class="mt-5 flex justify-end gap-3 border-t border-slate-200/70 pt-5 dark:border-slate-700/60">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="albumFormOpen = false">
                <AppIcon name="close" class="size-3.5" />
                取消
              </button>
              <button type="submit" class="btn-primary !px-5 !py-2 text-xs">
                <AppIcon name="check" class="size-3.5" />
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- 照片编辑弹窗 -->
    <Transition name="fade">
      <div
        v-if="albumPhotoFormOpen"
        class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="albumPhotoFormOpen = false"
      >
        <div class="modal-surface w-full max-w-sm rounded-2xl p-6 shadow-2xl">
          <h3 class="mb-4 flex items-center gap-2 border-b border-slate-200/70 pb-4 text-lg font-semibold text-slate-900 dark:border-slate-700/60 dark:text-white">
            <AppIcon name="pen" class="size-5 text-cyan-600 dark:text-cyan-400" />
            编辑照片
          </h3>
          <form class="space-y-4" @submit.prevent="savePhotoForm">
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">说明文字</label>
              <input
                v-model="albumPhotoForm.caption"
                maxlength="80"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="可选"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">所属分类</label>
              <select
                v-model="albumPhotoForm.categoryId"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option v-for="c in albumCategories" :key="c.id" :value="c.id">{{ c.title }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">排序</label>
              <input
                v-model.number="albumPhotoForm.sort"
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div class="mt-5 flex justify-end gap-3 border-t border-slate-200/70 pt-5 dark:border-slate-700/60">
              <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="albumPhotoFormOpen = false">
                <AppIcon name="close" class="size-3.5" />
                取消
              </button>
              <button type="submit" class="btn-primary !px-5 !py-2 text-xs">
                <AppIcon name="check" class="size-3.5" />
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- 计划编辑弹窗 -->
    <Transition name="fade">
      <div
        v-if="planFormOpen"
        class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="planFormOpen = false"
      >
        <div class="modal-surface max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 shadow-2xl">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold">
                <AppIcon
                  :name="planEditingId ? 'pen' : 'plus'"
                  class="size-4 text-cyan-600 dark:text-cyan-400"
                />
                {{ planEditingId ? '编辑计划' : '新增计划' }}
              </h4>
              <p v-if="planUploadName" class="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                已从「{{ planUploadName }}」解析生成，确认或微调后保存
              </p>
            </div>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              @click="planFormOpen = false"
            >
              <AppIcon name="x" class="size-5" />
            </button>
          </div>

          <form class="mt-5" @submit.prevent="savePlan">
            <div
              v-if="planErr"
              class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400"
            >
              {{ planErr }}
            </div>

            <!-- 基本信息 -->
            <div class="space-y-4">
              <div>
                <label class="mb-1 block text-xs text-slate-500">标题</label>
                <input
                  v-model="planForm.title"
                  type="text"
                  maxlength="80"
                  placeholder="计划标题"
                  class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs text-slate-500">副标题</label>
                <input
                  v-model="planForm.subtitle"
                  type="text"
                  maxlength="140"
                  placeholder="一句话说明这个计划"
                  class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs text-slate-500">摘要</label>
                <textarea
                  v-model="planForm.summary"
                  rows="2"
                  maxlength="500"
                  placeholder="列表卡片上展示的简介"
                  class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="mb-1 block text-xs text-slate-500">分类</label>
                  <select
                    v-model="planForm.category"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option v-for="c in planCatOptions" :key="c" :value="c">
                      {{ CATEGORY_EMOJI[c] }} {{ PLAN_CAT_LABELS[c] }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-slate-500">图标 emoji</label>
                  <input
                    v-model="planForm.emoji"
                    type="text"
                    maxlength="4"
                    placeholder="📌"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-slate-500">排序</label>
                  <input
                    v-model.number="planForm.sort"
                    type="number"
                    min="0"
                    max="999"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label class="mb-1 block text-xs text-slate-500">封面渐变</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="g in PLAN_GRADIENTS"
                    :key="g"
                    type="button"
                    class="h-8 w-14 rounded-lg bg-gradient-to-br ring-offset-2 transition"
                    :class="[g, planForm.gradient === g ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100']"
                    @click="planForm.gradient = g"
                  />
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-1 block text-xs text-slate-500">标签（用、或逗号分隔）</label>
                  <input
                    v-model="planTagsText"
                    type="text"
                    placeholder="音乐节、看海、古城"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-slate-500">路线（用 → 分隔，可留空）</label>
                  <input
                    v-model="planRouteText"
                    type="text"
                    placeholder="南京 → 聊城 → 青岛"
                    class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
              </div>

              <!-- 关键数字 -->
              <div>
                <div class="mb-1.5 flex items-center justify-between">
                  <label class="block text-xs text-slate-500">封面关键数字（最多 6 个）</label>
                  <button
                    type="button"
                    class="text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                    @click="planForm.meta = [...(planForm.meta ?? []), { label: '', value: '' }].slice(0, 6)"
                  >
                    + 添加
                  </button>
                </div>
                <div v-if="!(planForm.meta ?? []).length" class="text-xs text-slate-400">暂无</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(m, i) in planForm.meta"
                    :key="i"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model="m.label"
                      type="text"
                      maxlength="20"
                      placeholder="名称，如 日期"
                      class="w-32 rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    />
                    <input
                      v-model="m.value"
                      type="text"
                      maxlength="40"
                      placeholder="数值，如 10.1 – 10.6"
                      class="flex-1 rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      class="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      @click="planForm.meta = (planForm.meta ?? []).filter((_, idx) => idx !== i)"
                    >
                      <AppIcon name="x" class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 内容区块预览 -->
            <div class="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
              <div class="mb-3 flex items-center justify-between">
                <h5 class="flex items-center gap-2 text-sm font-bold">
                  <AppIcon name="layers" class="size-4 text-cyan-600 dark:text-cyan-400" />
                  内容区块
                  <span class="text-xs font-normal text-slate-400">
                    共 {{ (planForm.sections ?? []).length }} 个
                  </span>
                </h5>
              </div>

              <p
                v-if="!(planForm.sections ?? []).length"
                class="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-400 dark:bg-slate-800/60"
              >
                还没有内容。上传 md / html 文件会自动生成区块，也可以先保存基础信息后再补充。
              </p>

              <div v-else class="space-y-2">
                <div
                  v-for="(s, i) in planForm.sections"
                  :key="i"
                  class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <AppIcon :name="planSectionIcon(s)" class="size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <span
                    class="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {{ PLAN_SECTION_LABELS[s.kind] }}
                  </span>
                  <input
                    v-model="s.title"
                    type="text"
                    maxlength="80"
                    class="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-slate-300 focus:border-cyan-400 focus:bg-white dark:hover:border-slate-600 dark:focus:bg-slate-900"
                  />
                  <span class="shrink-0 text-[11px] text-slate-400">{{ sectionSummary(s) }}</span>
                  <button
                    type="button"
                    class="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-700"
                    :disabled="i === 0"
                    title="上移"
                    @click="movePlanSection(i, -1)"
                  >
                    <AppIcon name="chevron-up" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-slate-700"
                    :disabled="i === (planForm.sections ?? []).length - 1"
                    title="下移"
                    @click="movePlanSection(i, 1)"
                  >
                    <AppIcon name="chevron-down" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    title="删除该区块"
                    @click="removePlanSection(i)"
                  >
                    <AppIcon name="trash" class="size-3.5" />
                  </button>
                </div>
              </div>

              <p v-if="(planForm.tips ?? []).length" class="mt-3 text-[11px] text-slate-400">
                另有 {{ (planForm.tips ?? []).length }} 组「要点提醒」，会显示在详情页底部
              </p>
            </div>

            <!-- 底部操作 -->
            <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
              <label class="flex items-center gap-2 text-xs text-slate-500">
                <input v-model="planForm.visible" type="checkbox" class="size-4 accent-cyan-500" />
                在前台显示
              </label>
              <div class="flex gap-3">
                <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="planFormOpen = false">
                  <AppIcon name="close" class="size-3.5" />
                  取消
                </button>
                <button type="submit" class="btn-primary !px-5 !py-2 text-xs" :disabled="planSaving">
                  <AppIcon name="check" class="size-3.5" />
                  {{ planSaving ? '保存中…' : '保存' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
