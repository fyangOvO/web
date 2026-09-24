<script setup lang="ts">
/**
 * SilkBackground — 絲綢背景。
 * 多層 radial-gradient + 不同 background-position 緩慢漂移，產生絲綢質感。
 * 顏色用 --accent-1-rgb / --accent-2-rgb 交替，透明度 0.15。
 */
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="silk-layer silk-1" />
    <div class="silk-layer silk-2" />
    <div class="silk-layer silk-3" />
    <div class="silk-layer silk-4" />
  </div>
</template>

<style scoped>
.silk-layer {
  position: absolute;
  inset: -25%;
  width: 150%;
  height: 150%;
  will-change: background-position, transform;
}

/* 主色光斑 1 */
.silk-1 {
  background: radial-gradient(
    ellipse at 20% 30%,
    rgba(var(--accent-1-rgb), 0.15) 0%,
    transparent 50%
  );
  background-size: 80% 80%;
  background-repeat: no-repeat;
  animation: silk-drift-1 22s ease-in-out infinite;
}

/* 次色光斑 2 */
.silk-2 {
  background: radial-gradient(
    ellipse at 70% 60%,
    rgba(var(--accent-2-rgb), 0.15) 0%,
    transparent 50%
  );
  background-size: 70% 70%;
  background-repeat: no-repeat;
  animation: silk-drift-2 28s ease-in-out infinite;
}

/* 主色光斑 3 */
.silk-3 {
  background: radial-gradient(
    ellipse at 50% 80%,
    rgba(var(--accent-1-rgb), 0.15) 0%,
    transparent 45%
  );
  background-size: 90% 60%;
  background-repeat: no-repeat;
  animation: silk-drift-3 26s ease-in-out infinite;
}

/* 次色光斑 4 */
.silk-4 {
  background: radial-gradient(
    ellipse at 85% 25%,
    rgba(var(--accent-2-rgb), 0.15) 0%,
    transparent 45%
  );
  background-size: 65% 75%;
  background-repeat: no-repeat;
  animation: silk-drift-4 24s ease-in-out infinite;
}

@keyframes silk-drift-1 {
  0%, 100% { background-position: 20% 30%; transform: rotate(0deg); }
  50% { background-position: 60% 50%; transform: rotate(8deg); }
}
@keyframes silk-drift-2 {
  0%, 100% { background-position: 70% 60%; transform: rotate(0deg); }
  50% { background-position: 30% 40%; transform: rotate(-6deg); }
}
@keyframes silk-drift-3 {
  0%, 100% { background-position: 50% 80%; transform: scale(1); }
  50% { background-position: 40% 30%; transform: scale(1.1); }
}
@keyframes silk-drift-4 {
  0%, 100% { background-position: 85% 25%; transform: scale(1); }
  50% { background-position: 25% 70%; transform: scale(0.92); }
}

/* 減少動畫偏好：停止漂移 */
@media (prefers-reduced-motion: reduce) {
  .silk-layer {
    animation: none !important;
  }
}
</style>
