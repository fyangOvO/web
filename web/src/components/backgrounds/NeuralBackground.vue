<script setup lang="ts">
/**
 * NeuralBackground — 神經網絡背景。
 * Canvas 繪製 40 個節點 + 連接線，節點緩慢移動，距離近的節點之間畫線。
 * 顏色跟隨主題 CSS 變量 --accent-1-rgb / --accent-2-rgb。
 */
import { onMounted, onUnmounted, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let resizeHandler: (() => void) | null = null;

const cleanup = () => {
  cancelAnimationFrame(raf);
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
};

onMounted(() => {
  const c = canvas.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const styles = getComputedStyle(document.documentElement);
  const accent1 =
    styles.getPropertyValue('--accent-1-rgb').trim() || '255,255,255';
  const accent2 =
    styles.getPropertyValue('--accent-2-rgb').trim() || '255,255,255';

  let w = 0;
  let h = 0;
  const resize = () => {
    w = c.width = c.offsetWidth;
    h = c.height = c.offsetHeight;
  };
  resize();
  resizeHandler = resize;
  window.addEventListener('resize', resize);

  const count = 40;
  const maxDist = 140;
  interface Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }
  const nodes: Node[] = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
  }));

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    // 連接線
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy);
        if (d < maxDist) {
          ctx.strokeStyle = `rgba(${accent2}, ${0.15 * (1 - d / maxDist)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    // 節點
    for (const n of nodes) {
      if (!reduce) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.fillStyle = `rgba(${accent1}, 0.6)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduce) raf = requestAnimationFrame(draw);
  };
  draw();
});

onUnmounted(cleanup);
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <canvas ref="canvas" class="neural-canvas" />
  </div>
</template>

<style scoped>
.neural-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
