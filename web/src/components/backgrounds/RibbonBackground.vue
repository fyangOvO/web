<script setup lang="ts">
/**
 * RibbonBackground — 絲帶背景。
 * 4 條飄動絲帶，使用 SVG path + animate 實現波浪式形變。
 * 絲帶用主題漸變填充，顏色跟隨 --accent-1-rgb / --accent-2-rgb。
 */

interface RibbonCfg {
  readonly id: number;
  readonly cy: number;
  readonly amp: number;
  readonly dur: number;
  readonly delay: number;
  readonly opacity: number;
}

const ribbons: readonly RibbonCfg[] = [
  { id: 1, cy: 28, amp: 14, dur: 11, delay: 0, opacity: 0.32 },
  { id: 2, cy: 48, amp: 20, dur: 14, delay: -3, opacity: 0.28 },
  { id: 3, cy: 68, amp: 12, dur: 9, delay: -6, opacity: 0.34 },
  { id: 4, cy: 84, amp: 18, dur: 16, delay: -9, opacity: 0.24 },
];

/** 絲帶靜止形狀（與 animate 的 values 起止一致） */
function basePath(cy: number, amp: number): string {
  return `M0 ${cy} C 20 ${cy - amp}, 40 ${cy + amp}, 60 ${cy} S 100 ${cy - amp}, 120 ${cy} S 160 ${cy + amp}, 180 ${cy} S 220 ${cy - amp}, 240 ${cy} L 240 100 L 0 100 Z`;
}
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <svg
      class="ribbon-svg"
      viewBox="0 0 240 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient :id="'rg-1'" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="`rgba(var(--accent-1-rgb), 0.3)`" />
          <stop offset="100%" :stop-color="`rgba(var(--accent-2-rgb), 0.3)`" />
        </linearGradient>
      </defs>

      <g
        v-for="r in ribbons"
        :key="r.id"
        :opacity="r.opacity"
        :transform="`translate(0, ${(r.id - 1) * 0})`"
      >
        <path
          :d="basePath(r.cy, r.amp)"
          fill="url(#rg-1)"
        >
          <animate
            attributeName="d"
            :dur="`${r.dur}s`"
            :begin="`${r.delay}s`"
            repeatCount="indefinite"
            :values="`
              ${basePath(r.cy, r.amp)};
              ${basePath(r.cy - r.amp, -r.amp)};
              ${basePath(r.cy, r.amp)};
            `"
          />
        </path>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ribbon-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 減少動畫偏好：凍結絲帶 */
@media (prefers-reduced-motion: reduce) {
  .ribbon-svg animate {
    display: none !important;
  }
}
</style>
