<script setup lang="ts">
/**
 * VideoTextBackground — 視頻文字背景。
 * 純 CSS 實現：垂直滾動文字流（Matrix 風格）+ 掃描線。
 * 文字色 rgba(var(--accent-1-rgb), 0.5)，掃描線 rgba(var(--accent-2-rgb), 0.1)。
 */

interface StreamCfg {
  readonly id: number;
  readonly left: number;
  readonly duration: number;
  readonly delay: number;
  readonly content: string;
}

const GLYPHS = '01ABCDEF<>{}[]/*+-=';
function makeStream(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  return s;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const streams: StreamCfg[] = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: rand(2, 96),
  duration: rand(6, 14),
  delay: rand(0, 8),
  content: makeStream(40),
}));
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 文字流列 -->
    <div
      v-for="s in streams"
      :key="s.id"
      class="stream"
      :style="{
        left: s.left + 'vw',
        animationDuration: s.duration + 's',
        animationDelay: s.delay + 's',
      }"
    >
      <span class="stream-text">{{ s.content }}</span>
    </div>

    <!-- 掃描線覆蓋層 -->
    <div class="scanlines" />
  </div>
</template>

<style scoped>
.stream {
  position: absolute;
  top: -100%;
  height: 200%;
  width: 14px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 16px;
  line-height: 1.2;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 2px;
  white-space: nowrap;
  animation: stream-fall linear infinite;
  will-change: transform;
}

.stream-text {
  display: block;
  color: rgba(var(--accent-1-rgb), 0.5);
  text-shadow: 0 0 6px rgba(var(--accent-1-rgb), 0.4);
}

@keyframes stream-fall {
  0% { transform: translateY(0); }
  100% { transform: translateY(50%); }
}

/* 掃描線：水平細線重複 */
.scanlines {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(var(--accent-2-rgb), 0.1) 0px,
    rgba(var(--accent-2-rgb), 0.1) 1px,
    transparent 1px,
    transparent 4px
  );
  pointer-events: none;
  opacity: 0.6;
}

/* 減少動畫偏好：文字靜止顯示 */
@media (prefers-reduced-motion: reduce) {
  .stream {
    animation: none !important;
    top: 0;
  }
}
</style>
