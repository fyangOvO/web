<script setup lang="ts">
/**
 * InteractiveGridBackground — 互動網格圖案背景。
 * 點陣網格（radial-gradient 圓點）+ 滑鼠移動時徑向高亮（--mouse-x / --mouse-y）。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
import { onMounted, onUnmounted, ref } from 'vue';

const root = ref<HTMLElement | null>(null);

const onMove = (e: MouseEvent) => {
  if (!root.value) return;
  root.value.style.setProperty('--mouse-x', `${e.clientX}px`);
  root.value.style.setProperty('--mouse-y', `${e.clientY}px`);
};

onMounted(() => window.addEventListener('mousemove', onMove));
onUnmounted(() => window.removeEventListener('mousemove', onMove));
</script>

<template>
  <div
    ref="root"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 overflow-hidden interactive-grid"
  >
    <div class="grid-dots" />
    <div class="grid-spotlight" />
  </div>
</template>

<style scoped>
.interactive-grid {
  --mouse-x: 50vw;
  --mouse-y: 50vh;
}

.grid-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    rgba(var(--accent-1-rgb), 0.15) 1.5px,
    transparent 1.5px
  );
  background-size: 28px 28px;
}

.grid-spotlight {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 220px at var(--mouse-x) var(--mouse-y),
    rgba(var(--accent-2-rgb), 0.18),
    transparent 70%
  );
  animation: grid-pulse 6s ease-in-out infinite;
}

@keyframes grid-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .grid-spotlight {
    animation: none !important;
  }
}
</style>
