<script setup lang="ts">
import type { Skill } from '../types';
import AppIcon from './ui/AppIcon.vue';
import SpotlightCard from './ui/SpotlightCard.vue';

defineProps<{ skills: Skill[] }>();
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <SpotlightCard
      v-for="(s, i) in skills"
      :key="s.id"
      class="glass p-6"
      :class="i === 0 ? 'sm:col-span-2 lg:col-span-2' : ''"
    >
      <div class="flex h-full flex-col gap-4">
        <div
          class="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 text-cyan-600 dark:text-cyan-400"
        >
          <AppIcon :name="s.icon" class="size-5" />
        </div>
        <div>
          <h3 class="text-base font-semibold">{{ s.category }}</h3>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {{ s.desc }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <span
            v-for="item in s.items"
            :key="item"
            class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:text-cyan-400"
          >
            {{ item }}
          </span>
        </div>
      </div>
    </SpotlightCard>
  </div>
</template>
