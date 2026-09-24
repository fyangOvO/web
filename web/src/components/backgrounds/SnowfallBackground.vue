<script setup lang="ts">
/**
 * SnowfallBackground — 雪花背景。
 * Canvas 繪製 60 片雪花從頂部下落，帶水平擺動。
 * 深色主題白色雪花，淺色主題淺灰雪花。
 */
import { onMounted, onUnmounted, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);

interface Flake {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  driftPhase: number;
  driftSpeed: number;
}

let ctx: CanvasRenderingContext2D | null = null;
let flakes: Flake[] = [];
let rafId = 0;
let width = 0;
let height = 0;
let isDark = false;

const FLAKE_COUNT = 60;

function createFlakes(count: number): Flake[] {
  const arr: Flake[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 3,
      speed: 0.4 + Math.random() * 1.2,
      drift: 12 + Math.random() * 24,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.005 + Math.random() * 0.015,
    });
  }
  return arr;
}

function detectDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  const color = isDark ? 'rgba(255,255,255,' : 'rgba(200,205,215,';
  for (const f of flakes) {
    f.driftPhase += f.driftSpeed;
    f.y += f.speed;
    const x = f.x + Math.sin(f.driftPhase) * f.drift;
    if (f.y > height + 5) {
      f.y = -5;
      f.x = Math.random() * width;
    }
    ctx.fillStyle = `${color}${0.5 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }
  rafId = requestAnimationFrame(draw);
}

function resize() {
  const c = canvasRef.value;
  if (!c) return;
  const parent = c.parentElement;
  if (!parent) return;
  width = parent.clientWidth;
  height = parent.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = width * dpr;
  c.height = height * dpr;
  c.style.width = `${width}px`;
  c.style.height = `${height}px`;
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  flakes = createFlakes(FLAKE_COUNT);
}

function onResize() {
  cancelAnimationFrame(rafId);
  resize();
  if (!reducedMotion) rafId = requestAnimationFrame(draw);
}

let reducedMotion = false;
let observer: MutationObserver | null = null;

onMounted(() => {
  const c = canvasRef.value;
  if (!c) return;
  ctx = c.getContext('2d');
  if (!ctx) return;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  isDark = detectDark();
  resize();
  if (!reducedMotion) {
    rafId = requestAnimationFrame(draw);
  } else {
    draw();
  }
  window.addEventListener('resize', onResize);
  observer = new MutationObserver(() => { isDark = detectDark(); });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  observer?.disconnect();
});
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
    <canvas ref="canvasRef" class="snow-canvas" />
  </div>
</template>

<style scoped>
.snow-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
