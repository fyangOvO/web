<script setup lang="ts">
/**
 * BubblesBackground — 氣泡背景。
 * 12 個半透明圓形從底部上升，大小隨機，有浮動動畫。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
interface Bubble {
  left: number;
  size: number;
  duration: number;
  delay: number;
}

const bubbles: Bubble[] = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 8.3 + (i % 3) * 4) % 100,
  size: 16 + ((i * 7) % 60),
  duration: 12 + (i % 5) * 4,
  delay: (i % 6) * 1.5,
}));
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="(b, i) in bubbles"
      :key="i"
      class="bubble"
      :style="{
        left: `${b.left}%`,
        width: `${b.size}px`,
        height: `${b.size}px`,
        animationDuration: `${b.duration}s`,
        animationDelay: `${b.delay}s`,
      }"
    />
  </div>
</template>

<style scoped>
.bubble {
  position: absolute;
  bottom: -80px;
  border-radius: 50%;
  border: 1px solid rgba(var(--accent-1-rgb), 0.1);
  background: rgba(var(--accent-2-rgb), 0.05);
  animation: bubble-rise linear infinite;
  will-change: transform;
}

@keyframes bubble-rise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-110vh) scale(1.1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bubble {
    animation: none !important;
    opacity: 0.5;
  }
}
</style>
