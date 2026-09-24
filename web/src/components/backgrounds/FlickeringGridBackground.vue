<script setup lang="ts">
/**
 * FlickeringGridBackground — 閃爍網格背景。
 * CSS 網格線（linear-gradient）+ 隨機格子閃爍（隨機 animation-delay）。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
interface Flicker {
  x: number;
  y: number;
  delay: number;
  duration: number;
}

const flickers: Flicker[] = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 13 + 7) % 100,
  y: (i * 17 + 11) % 100,
  delay: (i % 6) * 0.7,
  duration: 2 + (i % 4),
}));
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="grid-lines" />
    <div
      v-for="(f, i) in flickers"
      :key="i"
      class="grid-flicker"
      :style="{
        left: `${f.x}%`,
        top: `${f.y}%`,
        animationDelay: `${f.delay}s`,
        animationDuration: `${f.duration}s`,
      }"
    />
  </div>
</template>

<style scoped>
.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(var(--accent-1-rgb), 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--accent-1-rgb), 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.grid-flicker {
  position: absolute;
  width: 40px;
  height: 40px;
  background: rgba(var(--accent-2-rgb), 0.3);
  animation: grid-flicker ease-in-out infinite;
}

@keyframes grid-flicker {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .grid-flicker {
    animation: none !important;
    opacity: 0.2;
  }
}
</style>
