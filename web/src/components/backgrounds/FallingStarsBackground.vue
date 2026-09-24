<script setup lang="ts">
/**
 * FallingStarsBackground — 流星背景。
 * 6 條流星從右上向左下劃過，帶漸變尾跡。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
const stars = Array.from({ length: 6 }, (_, i) => ({
  top: i * 14 + 5,
  delay: i * 2.5,
  duration: 4 + (i % 3),
}));
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="(s, i) in stars"
      :key="i"
      class="star"
      :style="{
        top: `${s.top}%`,
        animationDelay: `${s.delay}s`,
        animationDuration: `${s.duration}s`,
      }"
    />
  </div>
</template>

<style scoped>
.star {
  position: absolute;
  top: 0;
  left: 100%;
  width: 140px;
  height: 2px;
  background: linear-gradient(
    to right,
    transparent,
    rgba(var(--accent-2-rgb), 0.3),
    rgba(var(--accent-1-rgb), 0.8)
  );
  border-radius: 999px;
  filter: drop-shadow(0 0 4px rgba(var(--accent-1-rgb), 0.8));
  animation: star-fall linear infinite;
  will-change: transform;
}

@keyframes star-fall {
  0% {
    transform: translate(0, 0) rotate(-25deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate(-120vw, 60vh) rotate(-25deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .star {
    animation: none !important;
    opacity: 0;
  }
}
</style>
