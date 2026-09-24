<script setup lang="ts">
/**
 * ThunderstormBackground — 雷暴背景。
 * Canvas 繪製雨滴下落 + CSS animation 模擬隨機閃電（全屏短暫變亮）。
 * 雨滴用 rgba(var(--accent-2-rgb), 0.3) 線條。
 */
import { onMounted, onUnmounted, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  wind: number;
}

let ctx: CanvasRenderingContext2D | null = null;
let drops: Drop[] = [];
let rafId = 0;
let width = 0;
let height = 0;
let accent2Rgb = '37, 99, 235';
let reducedMotion = false;
let observer: MutationObserver | null = null;

const DROP_COUNT = 140;

function createDrops(count: number): Drop[] {
  const arr: Drop[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 10 + Math.random() * 18,
      speed: 6 + Math.random() * 8,
      wind: 1.5,
    });
  }
  return arr;
}

function readAccent2() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-2-rgb')
    .trim();
  if (raw) accent2Rgb = raw;
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = `rgba(${accent2Rgb}, 0.3)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of drops) {
    d.y += d.speed;
    d.x += d.wind;
    if (d.y > height) {
      d.y = -d.len;
      d.x = Math.random() * width;
    }
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.wind * 0.5, d.y + d.len);
  }
  ctx.stroke();
  if (!reducedMotion) rafId = requestAnimationFrame(draw);
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
  drops = createDrops(DROP_COUNT);
}

function onResize() {
  cancelAnimationFrame(rafId);
  resize();
  if (!reducedMotion) rafId = requestAnimationFrame(draw);
}

onMounted(() => {
  const c = canvasRef.value;
  if (!c) return;
  ctx = c.getContext('2d');
  if (!ctx) return;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  readAccent2();
  resize();
  if (!reducedMotion) {
    rafId = requestAnimationFrame(draw);
  } else {
    draw();
  }
  window.addEventListener('resize', onResize);
  observer = new MutationObserver(readAccent2);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class', 'data-theme'],
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
    <!-- 暗色背景層 -->
    <div class="storm-bg" />

    <!-- 雨滴 Canvas -->
    <canvas ref="canvasRef" class="rain-canvas" />

    <!-- 閃電閃光層（CSS 動畫隨機閃爍） -->
    <div class="lightning" />
  </div>
</template>

<style scoped>
.storm-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.25), rgba(2, 6, 23, 0.35));
}

.rain-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.lightning {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0);
  pointer-events: none;
  animation: lightning-flash 9s infinite;
}

@keyframes lightning-flash {
  0%, 88%, 100% { background: rgba(255, 255, 255, 0); }
  89% { background: rgba(255, 255, 255, 0.5); }
  90% { background: rgba(255, 255, 255, 0.1); }
  91% { background: rgba(255, 255, 255, 0.4); }
  93% { background: rgba(255, 255, 255, 0); }
}

/* 減少動畫偏好：關閉閃電 */
@media (prefers-reduced-motion: reduce) {
  .lightning {
    animation: none !important;
  }
}
</style>
