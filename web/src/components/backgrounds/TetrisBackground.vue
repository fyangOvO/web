<script setup lang="ts">
/**
 * TetrisBackground — 俄羅斯方塊背景。
 * v-for 渲染預定義的方塊形狀（I/O/T/L/S/Z），隨機位置 + 獨立 animation-delay 緩慢下落。
 * 顏色用主題色 --accent-1-rgb / --accent-2-rgb。
 */

interface Tetromino {
  readonly shape: 'I' | 'O' | 'T' | 'L' | 'S' | 'Z';
  /** 形狀格子相對座標（4 格） */
  readonly cells: readonly [number, number][];
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly useAccent2: boolean;
}

/* 4 格為一組的方塊形狀（單位格） */
const SHAPES: Record<Tetromino['shape'], readonly [number, number][]> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const blocks: Tetromino[] = Array.from({ length: 9 }, (_, i) => {
  const shapes = Object.keys(SHAPES) as Tetromino['shape'][];
  const shape = shapes[i % shapes.length]!;
  return {
    shape,
    cells: SHAPES[shape],
    left: rand(2, 88),
    delay: rand(0, 12),
    duration: rand(14, 26),
    useAccent2: i % 2 === 1,
  } satisfies Tetromino;
});
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="(b, idx) in blocks"
      :key="idx"
      class="tetromino"
      :class="b.useAccent2 ? 'is-accent2' : 'is-accent1'"
      :style="{
        left: b.left + 'vw',
        animationDelay: b.delay + 's',
        animationDuration: b.duration + 's',
      }"
    >
      <span
        v-for="(cell, ci) in b.cells"
        :key="ci"
        class="cell"
        :style="{ transform: `translate(${cell[0] * 100}%, ${cell[1] * 100}%)` }"
      />
    </div>
  </div>
</template>

<style scoped>
.tetromino {
  position: absolute;
  top: -20vh;
  width: 18px;
  height: 18px;
  animation-name: tetris-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.cell {
  position: absolute;
  top: 0;
  left: 0;
  width: 18px;
  height: 18px;
  border-radius: 2px;
}

.is-accent1 .cell {
  background: rgba(var(--accent-1-rgb), 0.2);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-1-rgb), 0.3);
}

.is-accent2 .cell {
  background: rgba(var(--accent-2-rgb), 0.2);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-2-rgb), 0.3);
}

@keyframes tetris-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% {
    transform: translateY(130vh) rotate(90deg);
    opacity: 0;
  }
}

/* 減少動畫偏好：方塊靜止顯示 */
@media (prefers-reduced-motion: reduce) {
  .tetromino {
    animation: none !important;
    top: 20vh;
    opacity: 0.6;
  }
}
</style>
