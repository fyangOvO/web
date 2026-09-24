<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getPosts, getPostsByTag } from '../api';
import type { Post } from '../types';
import AppIcon from '../components/ui/AppIcon.vue';
import FriendLinksCard from '../components/sidebar/FriendLinksCard.vue';
import VerseCard from '../components/sidebar/VerseCard.vue';
import CalendarCard from '../components/sidebar/CalendarCard.vue';
import StatsCard from '../components/sidebar/StatsCard.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();

const posts = ref<Post[]>([]);
const activeTag = ref($t('common.all'));
const loading = ref(true);
const error = ref('');

const tags = computed(() => {
  const set = new Set<string>();
  posts.value.forEach((p) => p.tags.forEach((t) => set.add(t)));
  return [$t('common.all'), ...set];
});

const filtered = computed(() =>
  activeTag.value === $t('common.all')
    ? posts.value
    : posts.value.filter((p) => p.tags.includes(activeTag.value))
);

async function load(tag: string) {
  loading.value = true;
  error.value = '';
  try {
    posts.value = tag === $t('common.all') ? await getPosts(undefined, 'essay') : await getPostsByTag(tag, 'essay');
  } catch {
    error.value = $t('error.network');
  } finally {
    loading.value = false;
  }
}

function selectTag(tag: string) {
  activeTag.value = tag;
  void load(tag);
}

onMounted(() => load($t('common.all')));
</script>

<template>
  <div class="shell pb-16 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
        Essay
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('blog.essayTitle') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('blog.essaySubtitle') }}
      </p>
    </div>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
      <div class="min-w-0">
        <div v-reveal class="mb-8 flex flex-wrap justify-center gap-2.5">
      <button
        v-for="tag in tags"
        :key="tag"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-medium transition-all"
        :class="
          activeTag === tag
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
            : 'glass text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400'
        "
        @click="selectTag(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <div v-if="loading" class="mx-auto max-w-3xl space-y-3">
      <div v-for="i in 4" :key="i" class="skeleton h-16 rounded-2xl" />
    </div>

    <template v-else>
      <div v-if="filtered.length" class="mx-auto max-w-3xl">
        <div v-reveal class="glass overflow-hidden rounded-3xl">
          <RouterLink
            v-for="(p, i) in filtered"
            :key="p.id"
            :to="`/essay/${p.id}`"
            class="group flex items-center gap-5 px-6 py-5 transition-colors hover:bg-amber-500/5 md:px-8"
            :class="i > 0 ? 'border-t border-slate-200/60 dark:border-slate-800' : ''"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2.5">
                <h2 class="text-base font-semibold transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400 md:text-lg">
                  {{ p.title }}
                </h2>
                <span
                  v-for="t in p.tags"
                  :key="t"
                  class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                >
                  {{ t }}
                </span>
              </div>
              <p class="mt-1.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                {{ p.summary }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <span class="text-sm tabular-nums text-slate-400">{{ p.date }}</span>
              <span class="grid size-8 place-items-center rounded-full border border-slate-200 text-slate-400 transition-all group-hover:border-amber-400 group-hover:text-amber-500 group-hover:translate-x-0.5 dark:border-slate-700">
                <AppIcon name="arrow-right" class="size-4" />
              </span>
            </div>
          </RouterLink>
        </div>
      </div>

      <p v-else class="mt-16 text-center text-slate-500 dark:text-slate-400">
        {{ $t('blog.noEssays') }}
      </p>
    </template>

    <p v-if="error" class="mt-10 flex items-center justify-center gap-2 text-sm text-red-500">
      <AppIcon name="alert-circle" class="size-4" />
      {{ error }}
    </p>
      </div>

      <!-- 侧边栏：友链 + 日历 + 站点统计 -->
      <aside class="mt-12 space-y-6 lg:sticky lg:top-24 lg:mt-0">
        <FriendLinksCard />
        <VerseCard />
        <CalendarCard />
        <StatsCard />
      </aside>
    </div>
  </div>
</template>
