<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getProjects } from '../api';
import type { Project } from '../types';
import ProjectCard from '../components/ProjectCard.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();

const projects = ref<Project[]>([]);
const activeTag = ref($t('common.all'));
const loading = ref(true);
const error = ref('');

const tags = computed(() => {
  const set = new Set<string>();
  projects.value.forEach((p) => p.tags.forEach((t) => set.add(t)));
  return [$t('common.all'), ...set];
});

const filtered = computed(() =>
  activeTag.value === $t('common.all')
    ? projects.value
    : projects.value.filter((p) => p.tags.includes(activeTag.value))
);

onMounted(async () => {
  try {
    projects.value = await getProjects();
  } catch {
    error.value = $t('error.network');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Projects
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('projects.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('projects.subtitle') }}
      </p>
    </div>

    <!-- 标签筛选 -->
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
        @click="activeTag = tag"
      >
        {{ tag }}
      </button>
    </div>

    <p v-reveal class="mb-6 text-sm text-slate-500 dark:text-slate-400">
      {{ $t('common.of') }} {{ filtered.length }} {{ $t('common.items') }}
    </p>

    <div v-if="loading" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="skeleton h-72 rounded-2xl" />
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ProjectCard v-for="p in filtered" :key="p.id" :project="p" />
    </div>

    <p v-if="error" class="mt-10 flex items-center justify-center gap-2 text-sm text-red-500">
      <AppIcon name="alert-circle" class="size-4" />
      {{ error }}
    </p>
  </div>
</template>
