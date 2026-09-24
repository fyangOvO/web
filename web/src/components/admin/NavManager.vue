<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  adminGetNavLinks,
  adminCreateNavCategory,
  adminRenameNavCategory,
  adminDeleteNavCategory,
  adminCreateNavLink,
  adminUpdateNavLink,
  adminDeleteNavLink,
  adminReorderNavLinks,
  adminUploadImage,
} from '../../api';
import type { NavLinkItem } from '../../types';
import AppIcon from '../ui/AppIcon.vue';

/** 分类名 → 占位图标（语义匹配） */
function categoryIcon(name: string): string {
  const map: Record<string, string> = {
    '前端开发': 'code',
    '后端开发': 'server',
    '全栈开发': 'box',
    '移动开发': 'smartphone',
    '设计灵感': 'palette',
    '代码社区': 'book',
    '开发工具': 'tool',
    '效率工具': 'zap',
    '学习资源': 'graduation',
    '视频娱乐': 'play',
    '游戏': 'gamepad',
    'AI 工具': 'sparkle',
    'AI工具': 'sparkle',
    '导航': 'compass',
    '常用': 'star',
    '收藏': 'heart',
  };
  for (const [kw, icon] of Object.entries(map)) {
    if (name.includes(kw)) return icon;
  }
  return 'compass';
}

// 数据
const categories = ref<string[]>([]);
const links = ref<NavLinkItem[]>([]);
const loading = ref(false);
const errorMsg = ref('');

// UI 状态
const activeCategory = ref<string>('');
const showCategoryModal = ref(false);
const editingCategory = ref<string | null>(null); // 正在编辑（重命名）的分类
const categoryInput = ref('');

const showLinkModal = ref(false);
const editingLink = ref<NavLinkItem | null>(null);
const uploadingIcon = ref(false);
const linkForm = ref({
  category: '',
  name: '',
  url: '',
  desc: '',
  icon: '',
});

// 拖拽状态


/* ====================== 初始化 ====================== */
async function fetchData() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const d = await adminGetNavLinks();
    categories.value = d.categories;
    links.value = d.links;
    if (!activeCategory.value && categories.value.length) {
      activeCategory.value = categories.value[0];
    }
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

/* ====================== 计算 ====================== */
const linksByCategory = computed(() => {
  const map: Record<string, NavLinkItem[]> = {};
  categories.value.forEach((c) => (map[c] = []));
  links.value.forEach((l) => {
    if (!map[l.category]) map[l.category] = [];
    map[l.category].push(l);
  });
  // 每个分类内部按 sort 排序
  Object.values(map).forEach((arr) => arr.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)));
  return map;
});

/* ====================== 分类 CRUD ====================== */
function openCreateCategory() {
  editingCategory.value = null;
  categoryInput.value = '';
  showCategoryModal.value = true;
}
function openRenameCategory(cat: string) {
  editingCategory.value = cat;
  categoryInput.value = cat;
  showCategoryModal.value = true;
}

async function saveCategory() {
  const name = categoryInput.value.trim();
  if (!name) return;
  try {
    if (editingCategory.value) {
      const data = await adminRenameNavCategory(editingCategory.value, name);
      categories.value = data.categories;
      links.value = data.links;
      if (activeCategory.value === editingCategory.value) activeCategory.value = name;
    } else {
      categories.value = await adminCreateNavCategory(name);
    }
    showCategoryModal.value = false;
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || '保存失败';
  }
}

async function deleteCategory(cat: string) {
  const n = (linksByCategory.value[cat] || []).length;
  if (!confirm(`确认删除分类「${cat}」？该分类下 ${n} 个网站将一并删除`)) return;
  try {
    const data = await adminDeleteNavCategory(cat);
    categories.value = data.categories;
    links.value = data.links;
    if (activeCategory.value === cat) activeCategory.value = categories.value[0] || '';
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || '删除失败';
  }
}

/* ====================== 网站 CRUD ====================== */
function openCreateLink() {
  editingLink.value = null;
  linkForm.value = {
    category: activeCategory.value || categories.value[0] || '',
    name: '',
    url: '',
    desc: '',
    icon: '',
  };
  showLinkModal.value = true;
}

function openEditLink(l: NavLinkItem) {
  editingLink.value = l;
  linkForm.value = { category: l.category, name: l.name, url: l.url, desc: l.desc || '', icon: l.icon || '' };
  showLinkModal.value = true;
}

async function saveLink() {
  const f = linkForm.value;
  if (!f.name.trim() || !f.url.trim() || !f.category) {
    errorMsg.value = '名称 / URL / 分类 必填';
    return;
  }
  try {
    if (editingLink.value) {
      await adminUpdateNavLink(editingLink.value.id!, {
        category: f.category,
        name: f.name.trim(),
        url: f.url.trim(),
        desc: f.desc.trim(),
        icon: f.icon.trim(),
      });
    } else {
      await adminCreateNavLink({
        category: f.category,
        name: f.name.trim(),
        url: f.url.trim(),
        desc: f.desc.trim(),
        icon: f.icon.trim(),
        sort: (linksByCategory.value[f.category]?.length || 0),
      });
    }
    showLinkModal.value = false;
    await fetchData();
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || '保存失败';
  }
}

async function handleIconUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请上传图片文件';
    return;
  }
  uploadingIcon.value = true;
  try {
    const res = await adminUploadImage(file);
    linkForm.value.icon = res.url;
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.error || '上传失败';
  } finally {
    uploadingIcon.value = false;
    input.value = '';
  }
}

async function deleteLink(id: string) {
  if (!confirm('确认删除该网站？')) return;
  try {
    await adminDeleteNavLink(id);
    await fetchData();
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.msg || '删除失败';
  }
}

/* ====================== 拖拽排序 ====================== */
const dragId = ref<string | null>(null);

function onDragStart(id: string) {
  dragId.value = id;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDrop(targetId: string) {
  if (!dragId.value || dragId.value === targetId) return;
  const list = linksByCategory.value[activeCategory.value];
  const fromIdx = list.findIndex((l) => l.id === dragId.value);
  const toIdx = list.findIndex((l) => l.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return;

  // 在原数组上 splice 重排（linksByCategory 是 computed，直接改 links）
  // 先从全量 links 找到这两个元素交换
  const all = links.value;
  const fromLink = all.find((l) => l.id === dragId.value);
  const toLink = all.find((l) => l.id === targetId);
  if (!fromLink || !toLink || fromLink.category !== toLink.category) return;

  // 在同分类内按目标位置重排
  const catLinks = all.filter((l) => l.category === activeCategory.value);
  const others = all.filter((l) => l.category !== activeCategory.value);
  const from = catLinks.indexOf(fromLink);
  const to = catLinks.indexOf(toLink);
  catLinks.splice(from, 1);
  catLinks.splice(to, 0, fromLink);
  links.value = [...catLinks, ...others];

  dragId.value = null;
  _persistSort();
}

function _persistSort() {
  const toSave: { id: string; sort: number; category: string }[] = [];
  for (const cat of categories.value) {
    const items = links.value.filter((l) => l.category === cat);
    items.forEach((item, idx) => {
      item.sort = idx;
      toSave.push({ id: item.id!, sort: idx, category: cat });
    });
  }
  adminReorderNavLinks(toSave).catch((e) => {
    errorMsg.value = '排序保存失败: ' + (e?.response?.data?.msg || e.message);
  });
}

/* ====================== favicon ====================== */
function faviconOf(url: string) {
  try {
    const host = new URL(url).hostname;
    return `https://icon.horse/icon/${host}`;
  } catch {
    return '';
  }
}
const failedIcons = ref<Set<string>>(new Set());
function onFavError(url: string) {
  failedIcons.value = new Set(failedIcons.value).add(url);
}
</script>

<template>
  <div class="nav-manager">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-lg font-bold">🔗 网址导航管理</h3>
      <div class="flex gap-2">
        <button type="button" class="btn-primary !px-4 !py-2 text-xs" @click="openCreateCategory">
          <AppIcon name="plus" class="size-3.5" />
          新增分类
        </button>
        <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="fetchData">
          <AppIcon name="refresh-cw" class="size-3.5" />
          刷新
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-600">
      {{ errorMsg }}
    </p>

    <template v-if="loading">
      <p class="py-4 text-center text-sm text-slate-400">加载中…</p>
    </template>

    <template v-else>
      <!-- 分类 tabs -->
      <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="cat in categories"
        :key="cat"
        @click="activeCategory = cat"
        class="group flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-all"
        :class="
          activeCategory === cat
            ? 'border-transparent text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-[rgb(var(--accent-1-rgb))]/50 dark:border-slate-600 dark:bg-slate-800'
        "
        :style="
          activeCategory === cat
            ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }
            : undefined
        "
      >
        <AppIcon :name="categoryIcon(cat)" class="size-3.5" />
        <span>{{ cat }}</span>
        <span class="text-xs opacity-70">({{ (linksByCategory[cat] || []).length }})</span>
        <!-- 操作按钮 -->
        <span class="ml-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" v-if="activeCategory === cat">
          <span @click.stop="openRenameCategory(cat)" title="重命名" class="cursor-pointer text-xs hover:underline">✎</span>
          <span @click.stop="deleteCategory(cat)" title="删除分类" class="cursor-pointer text-xs hover:text-red-500">×</span>
        </span>
      </button>
    </div>

    <!-- 当前分类的网站列表 -->
    <div v-if="activeCategory" class="rounded-2xl border border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
        <span class="text-sm text-slate-500">{{ activeCategory }} · {{ (linksByCategory[activeCategory] || []).length }} 个网站</span>
        <button type="button" class="btn-primary !px-4 !py-1.5 text-xs" @click="openCreateLink">
          <AppIcon name="plus" class="size-3.5" />
          添加网站
        </button>
      </div>

      <div
        class="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="l in linksByCategory[activeCategory]"
          :key="l.id"
          draggable="true"
          @dragstart="onDragStart(l.id!)"
          @dragover="onDragOver"
          @drop="onDrop(l.id!)"
          :class="[
            'group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all',
            'hover:border-[rgb(var(--accent-1-rgb))]/30 hover:bg-slate-50 dark:hover:bg-slate-800',
            dragId === l.id ? 'opacity-50' : '',
          ]"
        >
          <!-- 拖拽把手 -->
          <span class="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing select-none" title="拖拽排序">⋮⋮</span>

          <!-- icon / favicon + 首字 fallback -->
          <span
            class="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-bold transition-transform duration-300 ease-out will-change-transform group-hover:rotate-[8deg] group-hover:scale-110"
            :style="{
              background: 'linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.15), rgba(var(--accent-2-rgb), 0.15))',
              color: 'rgb(var(--accent-1-rgb))',
            }"
          >
            {{ l.name.slice(0, 1) }}
            <img
              v-if="l.icon || faviconOf(l.url)"
              v-show="l.icon || !failedIcons.has(l.url)"
              :src="l.icon || faviconOf(l.url)"
              alt=""
              loading="lazy"
              class="absolute inset-0 size-full rounded-lg bg-white object-cover dark:bg-slate-800"
              @error="onFavError(l.url)"
            />
          </span>

          <div class="min-w-0 flex-1">
            <a
              :href="l.url"
              target="_blank"
              class="block truncate text-sm font-semibold transition-colors hover:text-[rgb(var(--accent-1-rgb))]"
            >
              {{ l.name }}
            </a>
            <p class="truncate text-xs text-slate-400">{{ l.desc || '—' }}</p>
          </div>

          <div class="flex gap-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700"
              @click="openEditLink(l)"
            >
              <AppIcon name="edit" class="size-3" />
              编辑
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              @click="deleteLink(l.id!)"
            >
              <AppIcon name="trash" class="size-3" />
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 空分类提示 -->
      <div
        v-if="linksByCategory[activeCategory]?.length === 0"
        class="col-span-full py-10 text-center text-sm text-slate-400"
      >
        这个分类还没有网站，点击右上角「+ 添加网站」吧
      </div>
    </div>
    </template>

    <!-- 分类弹窗 -->
    <div
      v-if="showCategoryModal"
      class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="showCategoryModal = false"
    >
      <div class="modal-surface w-full max-w-sm rounded-2xl p-5 shadow-2xl">
        <h4 class="mb-4 flex items-center gap-2 text-base font-bold">
          <AppIcon :name="editingCategory ? 'pen' : 'plus'" class="size-4 text-cyan-600 dark:text-cyan-400" />
          {{ editingCategory ? '重命名分类' : '新增分类' }}
        </h4>
        <input
          v-model="categoryInput"
          placeholder="分类名（如：前端开发）"
          class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-800"
          @keyup.enter="saveCategory"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="btn-ghost !px-4 !py-2 text-xs"
            @click="showCategoryModal = false"
          >
            <AppIcon name="close" class="size-3.5" />
            取消
          </button>
          <button type="button" class="btn-primary !px-4 !py-2 text-xs" @click="saveCategory">
            <AppIcon name="check" class="size-3.5" />
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- 网站弹窗 -->
    <div
      v-if="showLinkModal"
      class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="showLinkModal = false"
    >
      <div class="modal-surface w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h4 class="mb-4 flex items-center gap-2 text-base font-bold">
          <AppIcon :name="editingLink ? 'pen' : 'plus'" class="size-4 text-cyan-600 dark:text-cyan-400" />
          {{ editingLink ? '编辑网站' : '新增网站' }}
        </h4>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-slate-500">分类</label>
            <select v-model="linkForm.category" class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent-1-rgb))] dark:border-slate-600 dark:bg-slate-800">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">名称 *</label>
            <input v-model="linkForm.name" placeholder="如：Vue.js" class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent-1-rgb))] dark:border-slate-600 dark:bg-slate-800" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">URL *</label>
            <input v-model="linkForm.url" placeholder="https://..." class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent-1-rgb))] dark:border-slate-600 dark:bg-slate-800" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">简介</label>
            <input v-model="linkForm.desc" placeholder="可选" class="w-full rounded-lg border border-slate-300 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent-1-rgb))] dark:border-slate-600 dark:bg-slate-800" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">图标（可选）</label>
            <div class="flex items-center gap-3">
              <div class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                <img v-if="linkForm.icon" :src="linkForm.icon" alt="icon" class="size-full object-cover" />
                <span v-else>无</span>
              </div>
              <div class="flex flex-1 gap-2">
                <label class="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                  {{ uploadingIcon ? '上传中...' : '选择图片' }}
                  <input type="file" accept="image/*" class="hidden" :disabled="uploadingIcon" @change="handleIconUpload" />
                </label>
                <button
                  v-if="linkForm.icon"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
                  @click="linkForm.icon = ''"
                >
                  <AppIcon name="x" class="size-3" />
                  清除
                </button>
              </div>
            </div>
            <p class="mt-1 text-[11px] text-slate-400">不填则自动从 URL 生成站点 favicon</p>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn-ghost !px-4 !py-2 text-xs" @click="showLinkModal = false">
            <AppIcon name="close" class="size-3.5" />
            取消
          </button>
          <button type="button" class="btn-primary !px-4 !py-2 text-xs" @click="saveLink">
            <AppIcon name="check" class="size-3.5" />
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
