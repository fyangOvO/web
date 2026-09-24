<script setup lang="ts">
import type { Project } from '../types';
import AppIcon from './ui/AppIcon.vue';
import SpotlightCard from './ui/SpotlightCard.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();
defineProps<{ project: Project }>();
</script>

<template>
  <SpotlightCard class="glass group flex h-full flex-col overflow-hidden rounded-2xl">
    <!-- 封面区：渐变 + 点阵 + 图标 -->
    <div
      class="relative h-40 shrink-0 overflow-hidden"
      :style="{ background: project.gradient }"
    >
      <div class="dot-grid absolute inset-0 opacity-50" />
      <div
        class="absolute inset-0 grid place-items-center text-white/95 transition-transform duration-500 group-hover:scale-110"
      >
        <AppIcon :name="project.icon" class="size-12 drop-shadow-lg" />
      </div>
      <span
        class="absolute left-3 top-3 rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-white backdrop-blur"
      >
        {{ project.tags[0] }}
      </span>
      <span
        v-if="project.featured"
        class="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur"
      >
        {{ $t('projects.featured') }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-3 p-6">
      <h3 class="text-lg font-semibold tracking-tight">{{ project.title }}</h3>
      <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {{ project.desc }}
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="t in project.tech"
          :key="t"
          class="rounded-md bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400"
        >
          {{ t }}
        </span>
      </div>
      <div class="mt-auto flex items-center gap-5 pt-2">
        <a
          :href="project.demo"
          target="_blank"
          rel="noopener"
          class="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400"
          @click="project.demo === '#' && $event.preventDefault()"
        >
          <AppIcon name="external" class="size-4" />
          {{ $t('projects.demo') }}
        </a>
        <a
          :href="project.repo"
          target="_blank"
          rel="noopener"
          class="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          <AppIcon name="github" class="size-4" />
          {{ $t('projects.source') }}
        </a>
      </div>
    </div>
  </SpotlightCard>
</template>
