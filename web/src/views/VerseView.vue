<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { getHitokoto, getVersePoem, type HitokotoData, type PoemData } from '../api';
import { useI18n, type TranslationKey } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();

const FAV_KEY = 'verse_favorites';

interface FavItem {
  id: string;
  kind: 'poem' | 'quote';
  text: string;
  source: string;
  at: number;
}

/** 一言分类：'' 为全部，其余见 hitokoto 官方定义 */
const CATS: { code: string; key: TranslationKey }[] = [
  { code: '', key: 'verse.catAll' },
  { code: 'd', key: 'verse.cat.d' },
  { code: 'i', key: 'verse.cat.i' },
  { code: 'k', key: 'verse.cat.k' },
  { code: 'e', key: 'verse.cat.e' },
  { code: 'h', key: 'verse.cat.h' },
  { code: 'a', key: 'verse.cat.a' },
  { code: 'b', key: 'verse.cat.b' },
  { code: 'c', key: 'verse.cat.c' },
  { code: 'j', key: 'verse.cat.j' },
  { code: 'l', key: 'verse.cat.l' },
  { code: 'f', key: 'verse.cat.f' },
  { code: 'g', key: 'verse.cat.g' },
];

const poem = ref<PoemData | null>(null);
const quote = ref<HitokotoData | null>(null);
const poemLoading = ref(true);
const quoteLoading = ref(true);
const poemError = ref('');
const quoteError = ref('');
const cat = ref('');
const favs = ref<FavItem[]>([]);
const copiedId = ref('');

function loadFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    favs.value = Array.isArray(parsed) ? parsed : [];
  } catch {
    favs.value = [];
  }
}

function persist() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs.value.slice(0, 100)));
  } catch {
    /* 隐私模式下 localStorage 可能不可写，忽略 */
  }
}

function isFav(text: string) {
  return favs.value.some((f) => f.text === text);
}

function toggleFav(kind: 'poem' | 'quote', text: string, source: string) {
  if (!text) return;
  const idx = favs.value.findIndex((f) => f.text === text);
  if (idx >= 0) favs.value.splice(idx, 1);
  else favs.value.unshift({ id: `${Date.now()}`, kind, text, source, at: Date.now() });
  persist();
}

function removeFav(id: string) {
  favs.value = favs.value.filter((f) => f.id !== id);
  persist();
}

function clearFavs() {
  favs.value = [];
  persist();
}

async function copyText(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = text;
    setTimeout(() => {
      if (copiedId.value === text) copiedId.value = '';
    }, 1600);
  } catch {
    /* 无剪贴板权限时静默失败 */
  }
}

async function loadPoem(force = false) {
  poemLoading.value = true;
  poemError.value = '';
  try {
    const d = await getVersePoem(force);
    if (!d?.content) throw new Error('empty');
    poem.value = d;
  } catch {
    poemError.value = $t('verse.failed');
  } finally {
    poemLoading.value = false;
  }
}

async function loadQuote() {
  quoteLoading.value = true;
  quoteError.value = '';
  try {
    const d = await getHitokoto(cat.value || undefined);
    if (!d?.text) throw new Error('empty');
    quote.value = d;
  } catch {
    quoteError.value = $t('verse.failed');
  } finally {
    quoteLoading.value = false;
  }
}

function selectCat(code: string) {
  if (cat.value === code) return;
  cat.value = code;
  loadQuote();
}

const poemSource = computed(() => {
  const p = poem.value;
  if (!p) return '';
  const who = p.author || $t('verse.anonymous');
  return p.origin ? `${who} · 《${p.origin}》` : who;
});

const quoteSource = computed(() => {
  const q = quote.value;
  if (!q) return '';
  const who = q.fromWho || '';
  return q.from ? `${who ? who + ' · ' : ''}《${q.from}》` : who;
});

const favCountLabel = computed(() => $tFmt('verse.count', { n: favs.value.length }));

onMounted(() => {
  loadFavs();
  loadPoem();
  loadQuote();
});
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Verse
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('verse.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('verse.subtitle') }}
      </p>
    </div>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
      <div class="min-w-0 space-y-6">
        <!-- 今日诗词 -->
        <section
          v-reveal
          class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-8 ring-1 ring-slate-900/5 dark:ring-white/10 md:p-10"
        >
          <span
            class="pointer-events-none absolute -right-4 -top-8 select-none font-serif text-[10rem] leading-none text-cyan-500/10"
            aria-hidden="true"
          >
            &ldquo;
          </span>

          <div class="relative flex items-center gap-2">
            <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
              <AppIcon name="book" class="size-3.5" />
            </span>
            <h2 class="text-sm font-bold">{{ $t('verse.poemToday') }}</h2>
            <span
              v-if="poem?.category"
              class="ml-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400"
            >
              {{ poem.category }}
            </span>
          </div>

          <div v-if="poemLoading" class="mt-6 space-y-3">
            <div class="skeleton h-7 w-3/4 rounded-lg" />
            <div class="skeleton h-7 w-1/2 rounded-lg" />
          </div>

          <p v-else-if="poemError" class="mt-6 flex items-center gap-2 text-sm text-red-500">
            <AppIcon name="x" class="size-4" />
            {{ poemError }}
          </p>

          <template v-else-if="poem">
            <p class="mt-6 text-balance text-2xl font-medium leading-relaxed tracking-wide text-slate-800 md:text-3xl dark:text-slate-100">
              {{ poem.content }}
            </p>
            <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">{{ poemSource }}</p>

            <div class="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:text-cyan-400"
                @click="loadPoem(true)"
              >
                <AppIcon name="refresh-cw" class="size-3.5" />
                {{ $t('verse.anotherPoem') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                :class="
                  isFav(poem.content)
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'border border-slate-200 bg-white/70 text-slate-600 hover:border-rose-400 hover:text-rose-500 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300'
                "
                @click="toggleFav('poem', poem.content, poemSource)"
              >
                <AppIcon name="heart" class="size-3.5" :class="isFav(poem.content) ? 'fill-current' : ''" />
                {{ isFav(poem.content) ? $t('verse.unfavorite') : $t('verse.favorite') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:text-cyan-400"
                @click="copyText(poem.content)"
              >
                <AppIcon :name="copiedId === poem.content ? 'check' : 'type'" class="size-3.5" />
                {{ copiedId === poem.content ? $t('verse.copied') : $t('verse.copy') }}
              </button>
            </div>
          </template>
        </section>

        <!-- 一言 -->
        <section v-reveal class="glass rounded-3xl p-6 md:p-8">
          <div class="flex items-center gap-2">
            <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25">
              <AppIcon name="sparkle" class="size-3.5" />
            </span>
            <h2 class="text-sm font-bold">{{ $t('verse.hitokotoTitle') }}</h2>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <button
              v-for="c in CATS"
              :key="c.code"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
              :class="
                cat === c.code
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25'
                  : 'bg-slate-100 text-slate-500 hover:text-violet-600 dark:bg-white/5 dark:text-slate-400 dark:hover:text-violet-400'
              "
              @click="selectCat(c.code)"
            >
              {{ $t(c.key) }}
            </button>
          </div>

          <div v-if="quoteLoading" class="mt-6 space-y-3">
            <div class="skeleton h-5 w-2/3 rounded-lg" />
            <div class="skeleton h-4 w-1/3 rounded-lg" />
          </div>

          <p v-else-if="quoteError" class="mt-6 flex items-center gap-2 text-sm text-red-500">
            <AppIcon name="x" class="size-4" />
            {{ quoteError }}
          </p>

          <template v-else-if="quote">
            <p class="mt-6 text-lg leading-relaxed text-slate-700 dark:text-slate-200">
              {{ quote.text }}
            </p>
            <p v-if="quoteSource" class="mt-2 text-sm text-slate-400">{{ quoteSource }}</p>

            <div class="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-violet-400"
                @click="loadQuote"
              >
                <AppIcon name="refresh-cw" class="size-3.5" />
                {{ $t('verse.anotherQuote') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                :class="
                  isFav(quote.text)
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'border border-slate-200 text-slate-600 hover:border-rose-400 hover:text-rose-500 dark:border-slate-700 dark:text-slate-300'
                "
                @click="toggleFav('quote', quote.text, quoteSource)"
              >
                <AppIcon name="heart" class="size-3.5" :class="isFav(quote.text) ? 'fill-current' : ''" />
                {{ isFav(quote.text) ? $t('verse.unfavorite') : $t('verse.favorite') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-violet-400"
                @click="copyText(quote.text)"
              >
                <AppIcon :name="copiedId === quote.text ? 'check' : 'type'" class="size-3.5" />
                {{ copiedId === quote.text ? $t('verse.copied') : $t('verse.copy') }}
              </button>
            </div>
          </template>
        </section>
      </div>

      <!-- 侧栏：我的收藏 -->
      <aside class="mt-8 space-y-6 lg:sticky lg:top-24 lg:mt-0">
        <section class="glass rounded-3xl p-6">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-sm font-bold">
              <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
                <AppIcon name="star" class="size-3.5" />
              </span>
              {{ $t('verse.myFavorites') }}
            </h3>
            <button
              v-if="favs.length"
              type="button"
              class="text-xs text-slate-400 transition-colors hover:text-rose-500"
              @click="clearFavs"
            >
              {{ $t('verse.clearAll') }}
            </button>
          </div>

          <p class="mt-2 text-xs text-slate-400">{{ favCountLabel }}</p>

          <p v-if="!favs.length" class="mt-5 text-xs leading-relaxed text-slate-400">
            {{ $t('verse.favEmpty') }}
          </p>

          <ul v-else class="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            <li
              v-for="f in favs"
              :key="f.id"
              class="group rounded-2xl bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{{ f.text }}</p>
              <div class="mt-1.5 flex items-center justify-between gap-2">
                <span class="truncate text-[11px] text-slate-400">
                  {{ f.kind === 'poem' ? $t('verse.poemBadge') : $t('verse.quoteBadge') }}
                  <template v-if="f.source"> · {{ f.source }}</template>
                </span>
                <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    class="grid size-6 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-cyan-600 dark:hover:bg-white/10"
                    :aria-label="$t('verse.copy')"
                    @click="copyText(f.text)"
                  >
                    <AppIcon :name="copiedId === f.text ? 'check' : 'type'" class="size-3" />
                  </button>
                  <button
                    type="button"
                    class="grid size-6 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-white/10"
                    :aria-label="$t('verse.remove')"
                    @click="removeFav(f.id)"
                  >
                    <AppIcon name="trash" class="size-3" />
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
