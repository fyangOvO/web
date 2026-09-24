<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getPosts, getPostsByTag } from '../api';
import type { Post } from '../types';
import PostCard from '../components/PostCard.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import FriendLinksCard from '../components/sidebar/FriendLinksCard.vue';
import VerseCard from '../components/sidebar/VerseCard.vue';
import CalendarCard from '../components/sidebar/CalendarCard.vue';
import StatsCard from '../components/sidebar/StatsCard.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();

const posts = ref<Post[]>([]);
const activeTag = ref('全部');
const loading = ref(true);
const error = ref('');
const page = ref(1);
const pageSize = 6;

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

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));

const pagePosts = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize)
);

async function load(tag: string) {
  loading.value = true;
  error.value = '';
  try {
    posts.value = tag === $t('common.all') ? await getPosts(undefined, 'blog') : await getPostsByTag(tag, 'blog');
  } catch {
    error.value = $t('error.network');
  } finally {
    loading.value = false;
  }
}

function selectTag(tag: string) {
  activeTag.value = tag;
  page.value = 1;
  void load(tag);
}

function goPage(p: number) {
  page.value = p;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => load($t('common.all')));
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Blog
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('blog.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('blog.subtitle') }}
      </p>
    </div>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
      <div class="min-w-0">
        <div v-reveal class="mb-10 flex flex-wrap justify-center gap-2.5">
      <button
        v-for="tag in tags"
        :key="tag"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-medium transition-all"
        :class="
          activeTag === tag
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
            : 'glass text-slate-600 hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400'
        "
        @click="selectTag(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <div v-if="loading" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="skeleton h-56 rounded-2xl" />
    </div>

    <template v-else>
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <PostCard v-for="post in pagePosts" :key="post.id" :post="post" />
      </div>

      <p v-if="!pagePosts.length" class="mt-16 text-center text-slate-500 dark:text-slate-400">
        {{ $t('blog.noPosts') }}
      </p>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="mt-14 flex items-center justify-center gap-3">
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
          :disabled="page <= 1"
          :aria-label="$t('common.prev')"
          @click="goPage(page - 1)"
        >
          <AppIcon name="arrow-right" class="size-4 rotate-180" />
        </button>
        <span class="text-sm text-slate-600 dark:text-slate-300">
          {{ page }} / {{ totalPages }}
        </span>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
          :disabled="page >= totalPages"
          :aria-label="$t('common.next')"
          @click="goPage(page + 1)"
        >
          <AppIcon name="arrow-right" class="size-4" />
        </button>
      </div>
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
