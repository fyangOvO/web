<script setup lang="ts">
/**
 * PatternBackground — 圖案背景。
 * 重複圓點矩陣 + 六邊形蜂巢雙層拼接，顏色跟隨主題 --accent-1-rgb。
 * 緩慢背景位置偏移，產生呼吸感。
 */
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="pattern-layer pattern-dots" />
    <div class="pattern-layer pattern-hex" />
  </div>
</template>

<style scoped>
.pattern-layer {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
}

/* 圓點矩陣：用 radial-gradient 拼接等距圓點 */
.pattern-dots {
  background-image: radial-gradient(
    circle,
    rgba(var(--accent-1-rgb), 0.08) 1.5px,
    transparent 1.8px
  );
  background-size: 28px 28px;
  animation: pattern-shift 24s linear infinite;
}

/* 六邊形蜂巢：用多個 radial-gradient 拼出蜂巢紋理 */
.pattern-hex {
  background-image:
    radial-gradient(
      circle at 50% 50%,
      rgba(var(--accent-2-rgb), 0.05) 2px,
      transparent 3px
    );
  background-size: 48px 56px;
  background-position: 0 0;
  opacity: 0.6;
  animation: pattern-shift-rev 32s linear infinite;
}

@keyframes pattern-shift {
  0% { background-position: 0 0; }
  100% { background-position: 28px 28px; }
}

@keyframes pattern-shift-rev {
  0% { background-position: 0 0; }
  100% { background-position: -48px -56px; }
}

/* 減少動畫偏好：關閉偏移 */
@media (prefers-reduced-motion: reduce) {
  .pattern-dots,
  .pattern-hex {
    animation: none !important;
  }
}
</style>
