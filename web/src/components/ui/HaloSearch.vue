<script setup lang="ts">
/**
 * HaloSearch — 光暈搜索框。
 * 多層發光環 + 細微動畫，主題色跟隨 CSS 變數 --accent-1/--accent-2。
 * 搜索結果通過 /api/search 接口獲取，點擊結果跳轉到對應頁面。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

interface SearchHit {
  type: string;
  id: string;
  title: string;
  summary?: string;
  to: string;
  tags?: string[];
}

const { $t } = useI18n();
const router = useRouter();
const inputRef = ref<HTMLInputElement | null>(null);
const keyword = ref('');
const hits = ref<SearchHit[]>([]);
const loading = ref(false);
const open = ref(false);
const activeIdx = ref(-1);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 聚焦時展開 */
function onFocus() {
  open.value = true;
}

/** 點擊外部關閉 */
function onClickOutside(e: MouseEvent) {
  const el = document.getElementById('halo-search-root');
  if (el && !el.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

/** 防抖搜索 */
watch(keyword, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const kw = val.trim();
  if (!kw) { hits.value = []; activeIdx.value = -1; return; }
  debounceTimer = setTimeout(() => doSearch(kw), 220);
});

async function doSearch(kw: string) {
  loading.value = true;
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(kw)}&limit=8`);
    if (r.ok) hits.value = await r.json();
  } catch { /* 忽略 */ }
  loading.value = false;
  activeIdx.value = hits.value.length ? 0 : -1;
}

/** 高亮關鍵字 */
function highlight(text: string) {
  const kw = keyword.value.trim();
  if (!kw) return text;
  try {
    const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  } catch { return text; }
}

/** 類型標籤 */
const typeLabel: Record<string, string> = {
  blog: '博客', project: '项目', essay: '随笔',
  note: '图文', message: '留言', banner: '轮播',
};
const typeColor: Record<string, string> = {
  blog: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  project: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  essay: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  note: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  message: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  banner: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function onKeydown(e: KeyboardEvent) {
  if (!hits.value.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIdx.value = (activeIdx.value + 1) % hits.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx.value = (activeIdx.value - 1 + hits.value.length) % hits.value.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const hit = hits.value[activeIdx.value];
    if (hit) go(hit);
  } else if (e.key === 'Escape') {
    open.value = false;
    inputRef.value?.blur();
  }
}

function go(hit: SearchHit) {
  open.value = false;
  keyword.value = '';
  hits.value = [];
  router.push(hit.to);
}

const hasKeyword = computed(() => keyword.value.trim().length > 0);
</script>

<template>
  <div id="halo-search-root" class="relative">
    <!-- 光暈搜索框 -->
    <div
      class="halo-wrapper relative flex items-center rounded-full transition-all duration-300"
      :class="open || hasKeyword ? 'w-72 md:w-80' : 'w-56 md:w-64'"
    >
      <!-- 多層光暈偽元素（通過 CSS 類實現） -->
      <div class="halo-layer halo-layer-1" />
      <div class="halo-layer halo-layer-2" />
      <div class="halo-layer halo-layer-3" />

      <!-- 輸入框容器 -->
      <div
        class="halo-input-wrap relative z-10 flex w-full items-center gap-2 rounded-full border px-4 py-2"
        :class="[
          open || hasKeyword
            ? 'border-transparent shadow-[0_0_20px_rgba(var(--accent-1-rgb),0.25)]'
            : 'border-slate-200/70 dark:border-slate-700/70',
        ]"
        :style="{
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }"
      >
        <AppIcon name="search" class="size-4 shrink-0" :style="{ color: 'var(--accent-1)' }" />
        <input
          ref="inputRef"
          v-model="keyword"
          type="text"
          placeholder="全站搜索..."
          class="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          @focus="onFocus"
          @keydown="onKeydown"
        />
        <kbd
          v-if="!hasKeyword"
          class="hidden shrink-0 rounded border border-slate-300 bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 md:inline-block dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
        >
          ⌘K
        </kbd>
        <button
          v-if="hasKeyword"
          type="button"
          class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          @click="keyword = ''; hits = []"
        >
          <AppIcon name="close" class="size-4" />
        </button>
      </div>
    </div>

    <!-- 結果下拉面板 -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open && (loading || hits.length || hasKeyword)"
        class="absolute left-0 top-full z-50 mt-2 w-96 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200/80 p-2 shadow-2xl dark:border-slate-700/80"
        :style="{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 16px 48px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(var(--accent-1-rgb),0.1)',
        }"
      >
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-8 text-sm text-slate-500">
          <span class="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          <span class="ml-2">搜索中...</span>
        </div>

        <!-- 無結果 -->
        <div v-else-if="!hits.length" class="py-10 text-center text-sm text-slate-500">
          沒有找到相關「{{ keyword }}」
        </div>

        <!-- 結果列表 -->
        <ul v-else class="space-y-1">
          <li
            v-for="(h, i) in hits"
            :key="h.type + '-' + h.id"
            class="group cursor-pointer rounded-xl px-3 py-2 transition-all"
            :class="[
              i === activeIdx
                ? 'bg-slate-100 dark:bg-slate-800/60'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
            ]"
            :style="i === activeIdx ? { boxShadow: 'inset 3px 0 0 var(--accent-1)' } : {}"
            @click="go(h)"
            @mouseenter="activeIdx = i"
          >
            <div class="flex items-start gap-2.5">
              <span
                class="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                :class="typeColor[h.type] || typeColor.banner"
              >
                {{ typeLabel[h.type] || h.type }}
              </span>
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium text-slate-800 dark:text-slate-100"
                  v-html="highlight(h.title)"
                />
                <p
                  v-if="h.summary"
                  class="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400"
                  v-html="highlight(h.summary)"
                />
              </div>
              <AppIcon
                name="chevron-right"
                class="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                :style="{ color: 'var(--accent-1)' }"
              />
            </div>
          </li>
        </ul>

        <!-- 底部提示 -->
        <div class="mt-2 border-t border-slate-200/60 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-700/60">
          <span class="mr-3"><kbd class="rounded border border-slate-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-800">↑↓</kbd> {{ $t('search.switch') }}</span>
          <span class="mr-3"><kbd class="rounded border border-slate-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-800">Enter</kbd> {{ $t('search.open') }}</span>
          <span><kbd class="rounded border border-slate-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-800">Esc</kbd> {{ $t('search.close') }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ============ 多層光暈 ============ */
.halo-wrapper:hover .halo-layer {
  opacity: 1;
}

.halo-layer {
  position: absolute;
  inset: -2px;
  border-radius: 9999px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

/* 第 1 層：主光暈（跟隨主題色） */
.halo-layer-1 {
  background: radial-gradient(
    circle at center,
    rgba(var(--accent-1-rgb), 0.35) 0%,
    rgba(var(--accent-2-rgb), 0.2) 40%,
    transparent 70%
  );
  filter: blur(8px);
  animation: halo-pulse-1 4s ease-in-out infinite;
}

/* 第 2 層：外圈光暈 */
.halo-layer-2 {
  background: radial-gradient(
    circle at center,
    rgba(var(--accent-1-rgb), 0.15) 0%,
    transparent 60%
  );
  filter: blur(16px);
  transform: scale(1.3);
  animation: halo-pulse-2 6s ease-in-out infinite;
}

/* 第 3 層：高光掃過 */
.halo-layer-3 {
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(var(--accent-1-rgb), 0.12) 60deg,
    transparent 120deg,
    transparent 360deg
  );
  filter: blur(6px);
  animation: halo-spin 8s linear infinite;
  opacity: 0.6;
}

/* 聚焦時也顯示光暈 */
.halo-wrapper:focus-within .halo-layer {
  opacity: 1;
}
.halo-wrapper:focus-within .halo-layer-1 {
  animation-duration: 2s;
}

@keyframes halo-pulse-1 {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes halo-pulse-2 {
  0%, 100% { transform: scale(1.3); opacity: 0.4; }
  50% { transform: scale(1.4); opacity: 0.8; }
}
@keyframes halo-spin {
  from { transform: rotate(0deg) scale(1); }
  to { transform: rotate(360deg) scale(1); }
}

/* 高亮標記 */
:deep(mark) {
  background: rgba(var(--accent-1-rgb), 0.2);
  color: var(--accent-1);
  border-radius: 2px;
  padding: 0 2px;
}
</style>
