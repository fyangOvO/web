<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getPost, getPosts } from '../api';
import type { Post } from '../types';
import AppIcon from '../components/ui/AppIcon.vue';
import GradientText from '../components/ui/GradientText.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();
const route = useRoute();
const post = ref<Post | null>(null);
const siblings = ref<Post[]>([]);
const loading = ref(true);
const error = ref('');
const copied = ref(false);

const isEssay = computed(() => post.value?.category === 'essay');
const listPath = computed(() => (isEssay.value ? '/essay' : '/blog'));

const prevPost = computed(() => {
  const i = siblings.value.findIndex((p) => p.id === route.params.id);
  return i > 0 ? siblings.value[i - 1] : null;
});
const nextPost = computed(() => {
  const i = siblings.value.findIndex((p) => p.id === route.params.id);
  return i >= 0 && i < siblings.value.length - 1 ? siblings.value[i + 1] : null;
});

async function load() {
  loading.value = true;
  error.value = '';
  const id = String(route.params.id);
  try {
    post.value = await getPost(id);
    const cat = post.value?.category === 'essay' ? 'essay' : 'blog';
    const list = await getPosts(undefined, cat);
    siblings.value = list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch {
    error.value = $t('blog.loadError');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.params.id, load);

async function copyCode(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1600);
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-32">
    <div class="mx-auto max-w-3xl">
      <RouterLink
        :to="listPath"
        class="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400"
      >
        <AppIcon name="arrow-right" class="size-4 rotate-180" />
        {{ $t('blog.backToList') }}
      </RouterLink>

      <div v-if="loading" class="mt-8 space-y-4">
        <div class="skeleton h-10 w-3/4 rounded-xl" />
        <div class="skeleton h-5 w-1/3 rounded-lg" />
        <div class="skeleton h-64 rounded-2xl" />
      </div>

      <article v-else-if="post" class="mt-8">
        <header v-reveal>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-for="t in post.tags"
              :key="t"
              class="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400"
            >
              {{ t }}
            </span>
          </div>
          <h1 class="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            <GradientText>{{ post.title }}</GradientText>
          </h1>
          <div
            class="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400"
          >
            <span class="inline-flex items-center gap-1.5">
              <AppIcon name="calendar" class="size-4" />
              {{ post.date }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <AppIcon name="book" class="size-4" />
              {{ $tFmt('blog.readMinutes', { n: post.readMinutes }) }}
            </span>
          </div>
          <p class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {{ post.summary }}
          </p>
        </header>

        <div class="prose-body mt-6">
          <template v-for="(b, i) in post.blocks ?? []" :key="i">
            <p v-if="b.type === 'p'">{{ b.content }}</p>
            <h2 v-else-if="b.type === 'h2'">{{ b.content }}</h2>
            <h3 v-else-if="b.type === 'h3'">{{ b.content }}</h3>
            <blockquote v-else-if="b.type === 'quote'">{{ b.content }}</blockquote>
            <div v-else-if="b.type === 'tip'" class="tip-card">
              <AppIcon name="sparkle" class="mt-1 size-4 shrink-0" />
              <span>{{ b.content }}</span>
            </div>
            <div v-else-if="b.type === 'code'" class="relative group/code">
              <button
                type="button"
                class="absolute right-3 top-3 z-10 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-slate-300 opacity-0 transition-opacity hover:bg-white/20 group-hover/code:opacity-100"
                @click="copyCode(b.content ?? '')"
              >
                {{ copied ? $t('blog.copied') : $t('blog.copy') }}
              </button>
              <pre><code>{{ b.content }}</code></pre>
            </div>
            <ul v-else-if="b.type === 'list'">
              <li v-for="(item, j) in b.items ?? []" :key="j">{{ item }}</li>
            </ul>
          </template>
        </div>

        <!-- 上一篇 / 下一篇 -->
        <nav class="mt-12 grid gap-4 md:grid-cols-2">
          <RouterLink
            v-if="prevPost"
            :to="`${listPath}/${prevPost.id}`"
            class="group rounded-2xl border border-slate-200 p-5 transition-colors hover:border-amber-400/60 hover:bg-amber-500/5 dark:border-slate-700"
          >
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <AppIcon name="arrow-right" class="size-3.5 rotate-180" />
              {{ $t('blog.prevPost') }}
            </span>
            <p class="mt-2 line-clamp-2 font-semibold transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400">
              {{ prevPost.title }}
            </p>
            <p class="mt-1 text-xs text-slate-400">{{ prevPost.date }}</p>
          </RouterLink>
          <div v-else class="hidden md:block" />

          <RouterLink
            v-if="nextPost"
            :to="`${listPath}/${nextPost.id}`"
            class="group rounded-2xl border border-slate-200 p-5 text-right transition-colors hover:border-amber-400/60 hover:bg-amber-500/5 dark:border-slate-700"
          >
            <span class="flex items-center justify-end gap-1.5 text-xs text-slate-400">
              {{ $t('blog.nextPost') }}
              <AppIcon name="arrow-right" class="size-3.5" />
            </span>
            <p class="mt-2 line-clamp-2 font-semibold transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-400">
              {{ nextPost.title }}
            </p>
            <p class="mt-1 text-xs text-slate-400">{{ nextPost.date }}</p>
          </RouterLink>
          <div v-else class="hidden md:block" />
        </nav>

        <div
          class="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 p-6 dark:border-slate-700"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ isEssay ? $t('blog.ctaEssay') : $t('blog.ctaBlog') }}
          </p>
          <RouterLink to="/guestbook" class="btn-primary !px-5 !py-2.5 text-sm">
            {{ $t('blog.toGuestbook') }}
          </RouterLink>
        </div>
      </article>

      <p v-else class="mt-16 flex items-center justify-center gap-2 text-red-500">
        <AppIcon name="alert-circle" class="size-4" />
        {{ error }}
      </p>
    </div>
  </div>
</template>
