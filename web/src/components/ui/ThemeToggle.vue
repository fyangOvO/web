<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useTheme, type Theme } from '../../composables/useTheme';
import AppIcon from './AppIcon.vue';

const { theme, set, THEMES } = useTheme();
const open = ref(false);
const panelRef = ref<HTMLElement | null>(null);

function choose(t: Theme) {
  set(t);
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (panelRef.value && !panelRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="panelRef" class="relative">
    <button
      type="button"
      aria-label="切换主题"
      class="grid size-9 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-cyan-400"
      @click.stop="open = !open"
    >
      <AppIcon name="palette" class="size-4.5" />
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        class="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-xl backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/90"
      >
        <button
          v-for="m in THEMES"
          :key="m.key"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors"
          :class="
            theme === m.key
              ? 'bg-slate-100 dark:bg-slate-800'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          "
          @click.stop="choose(m.key)"
        >
          <span
            class="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            :style="{ background: `linear-gradient(135deg, ${m.accent1}, ${m.accent2})` }"
          />
          <span class="flex-1 text-left text-slate-700 dark:text-slate-200">{{ m.label }}</span>
          <AppIcon
            v-if="theme === m.key"
            name="check-circle"
            class="size-4 text-slate-500 dark:text-slate-300"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
