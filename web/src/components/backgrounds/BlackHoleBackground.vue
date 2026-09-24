<script setup lang="ts">
/**
 * BlackHoleBackground — 黑洞背景。
 * 中心深色圓盤 + 旋轉吸積盤（conic-gradient）+ 周圍星光扭曲。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
function starStyle(i: number) {
  const angle = (i / 24) * Math.PI * 2;
  const radius = 32 + (i % 3) * 6;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  return {
    left: `${x}%`,
    top: `${y}%`,
    animationDelay: `${(i % 6) * 0.6}s`,
  };
}
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 外層星光扭曲環 -->
    <div class="blackhole-halo" />
    <!-- 旋轉吸積盤 -->
    <div class="blackhole-disk" />
    <!-- 中心黑色圓盤（事件視界） -->
    <div class="blackhole-core" />
    <!-- 周圍星點 -->
    <div class="blackhole-stars">
      <span v-for="i in 24" :key="i" class="blackhole-star" :style="starStyle(i)" />
    </div>
  </div>
</template>

<style scoped>
.blackhole-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60vmin;
  height: 60vmin;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(var(--accent-1-rgb), 0.18) 0%,
    rgba(var(--accent-2-rgb), 0.1) 35%,
    transparent 65%
  );
  filter: blur(8px);
}

.blackhole-disk {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44vmin;
  height: 44vmin;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(var(--accent-1-rgb), 0.55),
    rgba(var(--accent-2-rgb), 0.35),
    rgba(var(--accent-1-rgb), 0.6),
    rgba(var(--accent-2-rgb), 0.25),
    rgba(var(--accent-1-rgb), 0.55)
  );
  -webkit-mask: radial-gradient(circle, transparent 38%, black 42%, black 100%);
  mask: radial-gradient(circle, transparent 38%, black 42%, black 100%);
  animation: blackhole-rotate 20s linear infinite;
}

.blackhole-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30vmin;
  height: 30vmin;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #000 55%, transparent 75%);
  box-shadow: 0 0 40px 10px rgba(var(--accent-1-rgb), 0.25);
}

.blackhole-stars {
  position: absolute;
  inset: 0;
}

.blackhole-star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: rgba(var(--accent-2-rgb), 0.8);
  border-radius: 50%;
  animation: blackhole-twinkle 3s ease-in-out infinite;
}

@keyframes blackhole-rotate {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes blackhole-twinkle {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .blackhole-disk,
  .blackhole-star {
    animation: none !important;
  }
}
</style>
