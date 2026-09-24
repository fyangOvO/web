<script setup lang="ts">
/**
 * LampBackground — 燈光效果背景。
 * 從頂部向下的錐形光（clip-path 遮罩）+ 光暈擴散 + 底部光池反射。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb。
 */
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 頂部光暈 -->
    <div class="lamp-halo" />
    <!-- 錐形光 -->
    <div class="lamp-cone" />
    <!-- 底部光池反射 -->
    <div class="lamp-pool" />
  </div>
</template>

<style scoped>
.lamp-halo {
  position: absolute;
  top: -10%;
  left: 50%;
  transform: translateX(-50%);
  width: 60vmin;
  height: 30vmin;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--accent-1-rgb), 0.3) 0%,
    transparent 70%
  );
  filter: blur(20px);
  animation: lamp-flicker 5s ease-in-out infinite;
}

.lamp-cone {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 25vmin solid transparent;
  border-right: 25vmin solid transparent;
  border-top: 90vh solid rgba(var(--accent-1-rgb), 0.08);
  filter: blur(2px);
  -webkit-mask: linear-gradient(to bottom, black, transparent 95%);
  mask: linear-gradient(to bottom, black, transparent 95%);
}

.lamp-pool {
  position: absolute;
  bottom: -5%;
  left: 50%;
  transform: translateX(-50%);
  width: 50vmin;
  height: 12vmin;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--accent-1-rgb), 0.25) 0%,
    transparent 70%
  );
  filter: blur(10px);
  animation: lamp-flicker 5s ease-in-out infinite reverse;
}

@keyframes lamp-flicker {
  0%,
  100% {
    opacity: 1;
  }
  45% {
    opacity: 0.85;
  }
  55% {
    opacity: 0.95;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lamp-halo,
  .lamp-pool {
    animation: none !important;
  }
}
</style>
