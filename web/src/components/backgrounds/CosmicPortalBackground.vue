<script setup lang="ts">
/**
 * CosmicPortalBackground — 宇宙傳送門背景。
 * 中心旋轉圓環（多層 box-shadow 發光）+ 透視隧道（縮放同心圓）。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
const rings = Array.from({ length: 8 }, (_, i) => i);
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 透視隧道：同心縮放圓 -->
    <div class="portal-tunnel">
      <div
        v-for="i in rings"
        :key="i"
        class="portal-ring"
        :style="{
          width: `${(i + 1) * 12}vmin`,
          height: `${(i + 1) * 12}vmin`,
          animationDelay: `${i * 0.4}s`,
        }"
      />
    </div>
    <!-- 旋轉發光圓環 -->
    <div class="portal-core" />
    <!-- 中心光暈 -->
    <div class="portal-glow" />
  </div>
</template>

<style scoped>
.portal-tunnel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.portal-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid rgba(var(--accent-2-rgb), 0.25);
  animation: portal-pulse 4s ease-in-out infinite;
}

.portal-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16vmin;
  height: 16vmin;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 3px solid rgba(var(--accent-1-rgb), 0.6);
  box-shadow:
    0 0 20px rgba(var(--accent-1-rgb), 0.6),
    0 0 40px rgba(var(--accent-2-rgb), 0.4),
    inset 0 0 20px rgba(var(--accent-1-rgb), 0.3);
  animation: portal-rotate 15s linear infinite;
}

.portal-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30vmin;
  height: 30vmin;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(var(--accent-1-rgb), 0.15) 0%,
    transparent 70%
  );
  animation: portal-glow 3s ease-in-out infinite;
}

@keyframes portal-rotate {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes portal-pulse {
  0%,
  100% {
    opacity: 0.1;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.05);
  }
}

@keyframes portal-glow {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .portal-core,
  .portal-ring,
  .portal-glow {
    animation: none !important;
  }
}
</style>
