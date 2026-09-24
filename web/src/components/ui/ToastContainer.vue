<script setup lang="ts">
import { useToast } from '../../composables/useToast';

const { items, dismiss } = useToast();

const icons = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
} as const;

const colors = {
  success: 'bg-emerald-500/95 border-emerald-400 text-white',
  error: 'bg-rose-500/95 border-rose-400 text-white',
  warning: 'bg-amber-500/95 border-amber-400 text-white',
  info: 'bg-slate-700/95 border-slate-500 text-white',
} as const;

const iconBg = {
  success: 'bg-emerald-300/30 text-white',
  error: 'bg-rose-300/30 text-white',
  warning: 'bg-amber-300/30 text-white',
  info: 'bg-slate-300/30 text-white',
} as const;
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-6 z-[9999] flex flex-col items-center gap-2 px-4">
      <TransitionGroup name="toast">
        <div
          v-for="t in items"
          :key="t.id"
          class="pointer-events-auto flex min-w-[240px] max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-md"
          :class="colors[t.type]"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            :class="iconBg[t.type]"
          >
            {{ icons[t.type] }}
          </span>
          <span class="flex-1 text-sm leading-snug">{{ t.message }}</span>
          <button
            class="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭"
            @click="dismiss(t.id)"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>
