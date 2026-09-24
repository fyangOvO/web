<script setup lang="ts">
import type { Post } from '../types';
import AppIcon from './ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();
defineProps<{ post: Post }>();
</script>

<template>
  <div class="gradient-border h-full">
    <RouterLink
      :to="`/blog/${post.id}`"
      class="gradient-border-inner flex h-full flex-col gap-3 p-6 transition-shadow duration-300 hover:shadow-xl hover:shadow-cyan-500/10"
    >
      <div
        class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400"
      >
        <span class="inline-flex items-center gap-1.5">
          <AppIcon name="calendar" class="size-3.5" />
          {{ post.date }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <AppIcon name="book" class="size-3.5" />
          {{ $tFmt('blog.readMinutes', { n: post.readMinutes }) }}
        </span>
      </div>
      <h3 class="text-lg font-semibold leading-snug tracking-tight">
        {{ post.title }}
      </h3>
      <p class="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {{ post.summary }}
      </p>
      <div class="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <span
          v-for="t in post.tags"
          :key="t"
          class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {{ t }}
        </span>
        <span
          class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400"
        >
          {{ $t('home.readMore') }}
          <AppIcon name="arrow-right" class="size-3.5" />
        </span>
      </div>
    </RouterLink>
  </div>
</template>
