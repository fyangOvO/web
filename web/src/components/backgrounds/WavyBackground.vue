<script setup lang="ts">
/**
 * WavyBackground — 波浪背景。
 * 多層 SVG 波浪疊加，底部向頂部排列，每層不同顏色和動畫速度。
 * 用 SVG path + animate 實現形變，顏色 rgba(var(--accent-1-rgb), 0.1-0.3)。
 */

interface WaveCfg {
  readonly id: number;
  readonly opacity: number;
  readonly dur: number;
  readonly delay: number;
  readonly bottom: number;
}

/** 由淺到深排列（頂層最透明，底層最深） */
const waves: readonly WaveCfg[] = [
  { id: 1, opacity: 0.1, dur: 14, delay: 0, bottom: 22 },
  { id: 2, opacity: 0.16, dur: 11, delay: -3, bottom: 14 },
  { id: 3, opacity: 0.22, dur: 9, delay: -5, bottom: 6 },
  { id: 4, opacity: 0.3, dur: 7, delay: -2, bottom: 0 },
];

/** 波浪基準形狀（與 animate values 起止一致） */
function basePath(): string {
  return 'M0 40 C 50 10, 110 70, 160 40 S 260 10, 320 40 L 320 80 L 0 80 Z';
}

/** 波浪反向形狀 */
function altPath(): string {
  return 'M0 40 C 50 70, 110 10, 160 40 S 260 70, 320 40 L 320 80 L 0 80 Z';
}
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <svg
      class="wavy-svg"
      viewBox="0 0 320 80"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        v-for="w in waves"
        :key="w.id"
        :opacity="w.opacity"
        :style="{ transform: `translateY(${(4 - w.id) * 0}px)`, bottom: w.bottom + 'vh' }"
      >
        <path
          :d="basePath()"
          :fill="`rgba(var(--accent-1-rgb), ${w.opacity})`"
        >
          <animate
            attributeName="d"
            :dur="`${w.dur}s`"
            :begin="`${w.delay}s`"
            repeatCount="indefinite"
            :values="`${basePath()}; ${altPath()}; ${basePath()}`"
          />
        </path>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.wavy-svg {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 50vh;
}

.wavy-svg g {
  position: relative;
}

/* 減少動畫偏好：波浪凍結 */
@media (prefers-reduced-motion: reduce) {
  .wavy-svg animate {
    display: none !important;
  }
}
</style>
