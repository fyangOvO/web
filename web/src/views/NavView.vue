<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getNavLinks } from '../api';
import type { NavLinksData } from '../types';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();

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

const data = ref<NavLinksData>({ categories: [], links: [] });
const keyword = ref('');
const activeCategory = ref('');
const loading = ref(true);
const failedIcons = ref<Set<string>>(new Set());

const stats = computed(() => {
  const cats = data.value.categories.length;
  return { cats, sites: data.value.links.length };
});

const groups = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const cats = activeCategory.value === '' ? data.value.categories : [activeCategory.value];
  return cats
    .map((cat) => ({
      category: cat,
      items: data.value.links.filter(
        (l) =>
          l.category === cat &&
          (!kw ||
            l.name.toLowerCase().includes(kw) ||
            (l.desc || '').toLowerCase().includes(kw) ||
            l.url.toLowerCase().includes(kw))
      ),
    }))
    .filter((g) => g.items.length > 0);
});

const totalShown = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0));

function faviconOf(url: string) {
  try {
    return `https://icon.horse/icon/${new URL(url).hostname}`;
  } catch {
    return '';
  }
}

function onFavError(url: string) {
  failedIcons.value = new Set(failedIcons.value).add(url);
}

function scrollToCat(cat: string) {
  activeCategory.value = cat;
  keyword.value = '';
  if (cat !== '') {
    window.setTimeout(() => {
      document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

onMounted(async () => {
  try {
    data.value = await getNavLinks();
  } catch {
    /* 后端未启动时静默 */
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell pb-12 pt-28 md:pt-36">
    <div class="mb-8 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Web Navigation
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
        {{ $t('navPage.title') }}
        <span class="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">·</span>
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('navPage.subtitle') }}
        <template v-if="stats.sites">{{ $tFmt('navPage.catsCount', { n: stats.cats }) }} · {{ $tFmt('navPage.sitesCount', { n: stats.sites }) }}</template>
      </p>

      <!-- 搜索 -->
      <div class="relative mx-auto mt-6 max-w-md">
        <AppIcon
          name="search"
          class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          v-model="keyword"
          type="text"
          :placeholder="$t('navPage.searchPlaceholder')"
          class="glass w-full rounded-full py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-cyan-400 dark:text-slate-200"
        />
      </div>

      <!-- 分类 tab -->
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-medium transition-all"
          :class="
            activeCategory === ''
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
              : 'glass text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400'
          "
          @click="scrollToCat('')"
        >
          {{ $t('common.all') }}
        </button>
        <button
          v-for="tab in data.categories"
          :key="tab"
          type="button"
          class="rounded-full px-4 py-2 text-sm font-medium transition-all"
          :class="
            activeCategory === tab
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
              : 'glass text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400'
          "
          @click="scrollToCat(tab)"
        >
          {{ tab }}
        </button>
      </div>
    </div>

    <!-- 分类区块 -->
    <div v-if="loading" class="py-16 text-center text-sm text-slate-400">{{ $t('navPage.loading') }}</div>

    <div v-else-if="!groups.length" class="glass mx-auto max-w-md rounded-3xl p-10 text-center">
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ $t('navPage.noResults') }}</p>
    </div>

    <div v-else class="space-y-10">
      <section v-for="g in groups" :id="`cat-${g.category}`" :key="g.category" v-reveal>
        <div class="mb-4 flex items-center gap-3">
          <span
            class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-cyan-500/25"
          >
            <AppIcon :name="categoryIcon(g.category)" class="size-4" />
          </span>
          <h2 class="text-lg font-bold tracking-tight">{{ g.category }}</h2>
          <span class="text-xs text-slate-400">{{ $tFmt('navPage.sitesCount', { n: g.items.length }) }}</span>
          <span class="h-px flex-1 bg-gradient-to-r from-slate-300/60 to-transparent dark:from-slate-700/60"></span>
        </div>

        <div
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
        >
          <a
            v-for="l in g.items"
            :key="l.url"
            :href="l.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group glass flex items-center gap-3 rounded-2xl p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-xl hover:shadow-cyan-500/10"
          >
            <span
              class="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 text-sm font-bold text-cyan-600 transition-transform duration-300 ease-out will-change-transform group-hover:rotate-[8deg] group-hover:scale-110 dark:text-cyan-400"
            >
              {{ l.name.slice(0, 1) }}
              <img
                v-if="faviconOf(l.url)"
                v-show="!failedIcons.has(l.url)"
                :src="faviconOf(l.url)"
                alt=""
                loading="lazy"
                class="absolute inset-0 size-full rounded-xl bg-white object-cover dark:bg-slate-800"
                @error="onFavError(l.url)"
              />
            </span>
            <span class="min-w-0">
              <span
                class="block truncate text-sm font-semibold transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400"
              >
                {{ l.name }}
              </span>
              <span class="block truncate text-xs text-slate-400">{{ l.desc || '—' }}</span>
            </span>
          </a>
        </div>
      </section>

      <p v-if="keyword && totalShown" class="pb-4 text-center text-xs text-slate-400">
        {{ $tFmt('navPage.totalMatch', { n: totalShown }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/*
 * 尊重系統「減少動效」設定：關閉圖示的放大與旋轉。
 * 注意 Tailwind v4 把 rotate-* / scale-* 編譯成獨立的 CSS 屬性
 * （rotate: 8deg / scale: 1.1），而不是寫進 transform，
 * 所以這裡必須分別重置 rotate 與 scale，只寫 transform:none 是無效的。
 */
@media (prefers-reduced-motion: reduce) {
  .group:hover > span {
    rotate: none !important;
    scale: none !important;
    transform: none !important;
  }
}
</style>
