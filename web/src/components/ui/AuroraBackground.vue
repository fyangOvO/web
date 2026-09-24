<script setup lang="ts">
/**
 * AuroraBackground — 极光背景（Inspira UI 风格）。
 * 多个高模糊度彩色光斑缓慢漂移 + 径向暗角，颜色全部跟随主题。
 * 主题色由 CSS 变量 --accent-1-rgb / --accent-2-rgb 驱动，切换主题即时生效。
 */
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 光斑層：3 個主色光斑（accent-1）+ 2 個次色光斑（accent-2） -->
    <div class="aurora-blob aurora-1" />
    <div class="aurora-blob aurora-2" />
    <div class="aurora-blob aurora-3" />
    <div class="aurora-blob aurora-4" />
    <div class="aurora-blob aurora-5" />

    <!-- 徑向暗角（邊緣壓暗，聚焦中心） -->
    <div class="aurora-vignette" />

    <!-- 細微噪點紋理（增加層次感） -->
    <div class="aurora-noise" />
  </div>
</template>

<style scoped>
/* ===== 光斑基礎樣式 ===== */
.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  mix-blend-mode: screen;
  will-change: transform;
}

/* 光斑 1：主色，左上 */
.aurora-1 {
  top: -10%;
  left: -5%;
  width: 45vw;
  height: 45vw;
  background: radial-gradient(circle, rgba(var(--accent-1-rgb), 0.5) 0%, transparent 70%);
  animation: aurora-float-1 18s ease-in-out infinite;
}

/* 光斑 2：次色，右上 */
.aurora-2 {
  top: -15%;
  right: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(var(--accent-2-rgb), 0.45) 0%, transparent 70%);
  animation: aurora-float-2 22s ease-in-out infinite;
}

/* 光斑 3：主色，中下 */
.aurora-3 {
  bottom: -20%;
  left: 30%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, rgba(var(--accent-1-rgb), 0.4) 0%, transparent 70%);
  animation: aurora-float-3 25s ease-in-out infinite;
}

/* 光斑 4：次色，左下 */
.aurora-4 {
  bottom: -15%;
  left: -10%;
  width: 35vw;
  height: 35vw;
  background: radial-gradient(circle, rgba(var(--accent-2-rgb), 0.35) 0%, transparent 70%);
  animation: aurora-float-4 20s ease-in-out infinite;
}

/* 光斑 5：混合色，右中 */
.aurora-5 {
  top: 40%;
  right: -5%;
  width: 30vw;
  height: 30vw;
  background: radial-gradient(
    circle,
    rgba(var(--accent-1-rgb), 0.3) 0%,
    rgba(var(--accent-2-rgb), 0.2) 50%,
    transparent 70%
  );
  animation: aurora-float-5 28s ease-in-out infinite;
}

/* ===== 徑向暗角 ===== */
.aurora-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.04) 70%,
    rgba(0, 0, 0, 0.12) 100%
  );
}

/* 深色主題下暗角更強 */
:global(.dark) .aurora-vignette {
  background: radial-gradient(
    ellipse at center,
    transparent 25%,
    rgba(0, 0, 0, 0.15) 65%,
    rgba(0, 0, 0, 0.35) 100%
  );
}

/* ===== 噪點紋理 ===== */
.aurora-noise {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ===== 光斑漂移動畫 ===== */
@keyframes aurora-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(8vw, 6vh) scale(1.1); }
  66% { transform: translate(-4vw, 10vh) scale(0.95); }
}
@keyframes aurora-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-6vw, 8vh) scale(1.08); }
  66% { transform: translate(5vw, -4vh) scale(0.92); }
}
@keyframes aurora-float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-8vw, -6vh) scale(1.12); }
}
@keyframes aurora-float-4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  40% { transform: translate(10vw, -5vh) scale(1.05); }
  70% { transform: translate(3vw, 7vh) scale(0.95); }
}
@keyframes aurora-float-5 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-7vw, -8vh) scale(1.1); }
}

/* ===== 減少動畫偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .aurora-blob {
    animation: none !important;
  }
}
</style>
