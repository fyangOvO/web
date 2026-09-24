<script setup lang="ts">
/**
 * ClickParticles — 点击粒子特效（独立组件）。
 * 颜色跟随主题 --accent-1/--accent-2，点击按钮/链接时触发爆炸。
 *
 * 后台可控项（useSettings）：
 * - clickEffectEnabled 总开关（关闭时监听与绘制全部停用）
 * - clickEffect     形态：爱心 / 炸开圆点 / 星星 / 自定义图片
 * - clickEffectSize 大小倍率 0.4~3（1 = 原始）
 * - clickEffectGlow 发光样式：无 / 柔和 / 强光 / 霓虹
 * - clickEffectGlowIntensity 发光强度 0~100
 * - clickEffectMulticolor 是否多彩（关闭则只用主题色）
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSettings } from '../../composables/useSettings';

const particleCanvasRef = ref<HTMLCanvasElement | null>(null);
const {
  clickEffectEnabled,
  clickEffect,
  customClickImage,
  clickEffectSize,
  clickEffectGlow,
  clickEffectGlowIntensity,
  clickEffectMulticolor,
} = useSettings();
const route = useRoute();
const isAdmin = computed(() => route.path.startsWith('/admin'));

type ParticleKind = 'hearts' | 'burst' | 'sparkle' | 'custom';
type GlowKind = 'none' | 'soft' | 'strong' | 'neon';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; decay: number;
  useAccent2: boolean; rotation: number; rotationSpeed: number;
  kind: ParticleKind; img?: HTMLImageElement;
  isBurst?: boolean; burstRgb?: string;
  /** 每个粒子独立相位，避免所有发光同步闪烁 */
  glowPhase: number;
}

let particleCtx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let rafId = 0;
let dpr = 1;
let accent1 = '#06b6d4';
let accent2 = '#2563eb';

const BURST_COLORS = [
  '255,107,107', '255,193,7', '76,175,80', '33,150,243',
  '156,39,176', '255,64,129', '0,229,255', '255,235,59', '255,87,34',
];

let customImg: HTMLImageElement | null = null;
function loadCustomImage(src: string) {
  if (!src) { customImg = null; return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { customImg = img; };
  img.onerror = () => { customImg = null; };
  img.src = src;
}
loadCustomImage(customClickImage.value);

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}
function readAccentColors() {
  const s = getComputedStyle(document.documentElement);
  const a1 = s.getPropertyValue('--accent-1').trim();
  const a2 = s.getPropertyValue('--accent-2').trim();
  if (a1) accent1 = a1;
  if (a2) accent2 = a2;
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x - size, y, x - size, y + topCurveHeight);
  ctx.bezierCurveTo(x - size, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 2, x, y + size);
  ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size, y + (size + topCurveHeight) / 2, x + size, y + topCurveHeight);
  ctx.bezierCurveTo(x + size, y, x, y, x, y + topCurveHeight);
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const spikes = 5;
  const outer = size;
  const inner = size * 0.45;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * 按当前发光设置配置画布阴影。
 * 用 shadowBlur + shadowColor 实现发光，比叠加多层绘制便宜且更平滑。
 * @param alpha 粒子当前透明度，用于让发光随粒子一起淡出
 */
function applyGlow(ctx: CanvasRenderingContext2D, rgb: string, size: number, alpha: number) {
  const glow = clickEffectGlow.value as GlowKind;
  if (glow === 'none') {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    return;
  }
  // 强度 0~100 映射到各档位的基准半径
  const k = Math.max(0, Math.min(100, clickEffectGlowIntensity.value)) / 100;
  const base =
    glow === 'soft' ? 8 :
    glow === 'strong' ? 22 :
    34; // neon
  const radius = base * (0.4 + k * 1.1) + size * 0.8;
  // 霓虹档额外提高饱和度感（用同色高透明度堆叠）
  const strength = glow === 'neon' ? 1 : glow === 'strong' ? 0.85 : 0.6;
  ctx.shadowBlur = radius;
  ctx.shadowColor = `rgba(${rgb}, ${Math.min(1, strength * (0.5 + k * 0.5)) * alpha})`;
}

function spawnParticles(x: number, y: number, isBurst = false) {
  const kind: ParticleKind = clickEffect.value === 'custom' && customImg ? 'custom' : clickEffect.value;
  // 大小倍率在此统一生效，各分支只需给出基础尺寸
  const scale = Math.max(0.4, Math.min(3, clickEffectSize.value || 1));
  const count = isBurst ? 36 : (kind === 'burst' ? 18 : 12);
  for (let i = 0; i < count; i++) {
    let vx = 0, vy = 0, size = 0;
    let particleKind = kind;
    let burstRgb: string | undefined;

    if (isBurst) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 6;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed - 1;
      size = (2 + Math.random() * 8) * scale;
      particleKind = 'burst';
      burstRgb = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
    } else {
      switch (kind) {
        case 'burst': {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 4;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          size = (3 + Math.random() * 5) * scale;
          break;
        }
        case 'sparkle': {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
          const speed = 1 + Math.random() * 2.5;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          size = (5 + Math.random() * 7) * scale;
          break;
        }
        case 'custom': {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 1.2 + Math.random() * 2.5;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          size = (20 + Math.random() * 16) * scale;
          break;
        }
        default: {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 1.5 + Math.random() * 3;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          size = (6 + Math.random() * 8) * scale;
        }
      }
    }
    particles.push({
      x, y, vx, vy, size,
      alpha: isBurst ? 1 : (kind === 'burst' ? 1 : 0.85 + Math.random() * 0.15),
      decay: isBurst ? 0.015 : (kind === 'burst' ? 0.018 : 0.01 + Math.random() * 0.012),
      useAccent2: Math.random() > 0.5,
      rotation: (Math.random() - 0.5) * (isBurst ? 2 : kind === 'burst' ? 2 : 0.5),
      rotationSpeed: (Math.random() - 0.5) * (isBurst ? 0.3 : kind === 'burst' ? 0.3 : 0.08),
      kind: particleKind,
      img: customImg || undefined,
      isBurst, burstRgb,
      glowPhase: Math.random() * Math.PI * 2,
    });
  }
}

function draw() {
  if (!particleCtx || !particleCanvasRef.value) return;
  const w = particleCanvasRef.value.width / dpr;
  const h = particleCanvasRef.value.height / dpr;
  particleCtx.clearRect(0, 0, w, h);

  const rgb1 = hexToRgb(accent1);
  const rgb2 = hexToRgb(accent2);
  const multicolor = clickEffectMulticolor.value;
  const glow = clickEffectGlow.value as GlowKind;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const gravity = p.isBurst ? 0.08 : (p.kind === 'burst' ? 0.02 : 0.05);
    p.vy += gravity;
    const drag = p.isBurst ? 0.985 : 0.995;
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    p.alpha -= p.decay;
    if (p.alpha <= 0 || p.y > h + 50) { particles.splice(i, 1); continue; }

    // 多彩关闭时：burst 的彩虹色退化为主题色，其余粒子统一用一个主题色
    const rgb = multicolor
      ? (p.burstRgb || (p.useAccent2 ? rgb2 : rgb1))
      : (glow === 'neon' ? rgb1 : (p.useAccent2 ? rgb2 : rgb1));

    const a = Math.max(0, p.alpha);
    particleCtx.save();
    particleCtx.translate(p.x, p.y);

    // 霓虹档：先用带阴影的同色描边描一遍轮廓，形成外圈光晕
    if (glow === 'neon' && p.kind !== 'custom') {
      particleCtx.save();
      applyGlow(particleCtx, rgb, p.size, a);
      particleCtx.strokeStyle = `rgba(${rgb},${a * 0.9})`;
      particleCtx.lineWidth = Math.max(1, p.size * 0.22);
      if (p.kind === 'sparkle') drawStar(particleCtx, 0, 0, p.size);
      else if (p.kind === 'burst') particleCtx.beginPath(), particleCtx.arc(0, 0, p.size, 0, Math.PI * 2);
      else drawHeart(particleCtx, 0, 0, p.size);
      particleCtx.stroke();
      particleCtx.restore();
    }

    particleCtx.rotate(p.rotation);
    particleCtx.globalAlpha = a;

    if (p.kind === 'custom' && p.img) {
      applyGlow(particleCtx, rgb, p.size, a * 0.6);
      particleCtx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
      particleCtx.shadowBlur = 0;
    } else if (p.kind === 'burst') {
      applyGlow(particleCtx, rgb, p.size, a);
      particleCtx.fillStyle = `rgba(${rgb},1)`;
      particleCtx.beginPath();
      particleCtx.arc(0, 0, p.size, 0, Math.PI * 2);
      particleCtx.fill();
      particleCtx.shadowBlur = 0;
      if (p.size > 3) {
        particleCtx.fillStyle = `rgba(255,255,255,${0.6 * a})`;
        particleCtx.beginPath();
        particleCtx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.25, 0, Math.PI * 2);
        particleCtx.fill();
      }
    } else if (p.kind === 'sparkle') {
      applyGlow(particleCtx, rgb, p.size, a);
      particleCtx.fillStyle = `rgba(${rgb},1)`;
      drawStar(particleCtx, 0, 0, p.size);
      particleCtx.fill();
      particleCtx.shadowBlur = 0;
    } else {
      applyGlow(particleCtx, rgb, p.size, a);
      particleCtx.fillStyle = `rgba(${rgb},1)`;
      drawHeart(particleCtx, 0, 0, p.size);
      particleCtx.fill();
      particleCtx.shadowBlur = 0;
    }
    particleCtx.restore();
  }
  particleCtx.globalAlpha = 1;
}

let lastTime = 0;
function loop(time: number) {
  if (time - lastTime > 33) { draw(); lastTime = time; }
  rafId = requestAnimationFrame(loop);
}

function resize() {
  const pc = particleCanvasRef.value;
  if (!pc) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  pc.width = w * dpr; pc.height = h * dpr;
  pc.style.width = `${w}px`; pc.style.height = `${h}px`;
  if (particleCtx) particleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest('button, a, [role="button"], input, textarea, select, label');
}

function handleClick(e: MouseEvent) {
  if (isAdmin.value) return;
  // 总开关关闭时不再生成粒子（组件若仍被挂载也安全）
  if (!clickEffectEnabled.value) return;
  const isBurst = isInteractiveTarget(e.target);
  spawnParticles(e.clientX, e.clientY, isBurst);
}

/** 后台改设置后立即在页面上试一下（用于预览按钮） */
function emitPreview(x: number, y: number, burst = true) {
  if (!clickEffectEnabled.value) return;
  spawnParticles(x, y, burst);
}
defineExpose({ emitPreview });

let observer: MutationObserver | null = null;

onMounted(() => {
  const pc = particleCanvasRef.value;
  if (!pc) return;
  particleCtx = pc.getContext('2d');
  readAccentColors();
  resize();
  rafId = requestAnimationFrame(loop);

  window.addEventListener('resize', resize);
  document.addEventListener('click', handleClick);

  observer = new MutationObserver(() => { readAccentColors(); });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'data-theme', 'class'],
  });
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', resize);
  document.removeEventListener('click', handleClick);
  observer?.disconnect();
});

watch(customClickImage, (url) => loadCustomImage(url));
</script>

<template>
  <!-- 点击粒子画布（穿透所有页面元素，确保可见） -->
  <canvas
    ref="particleCanvasRef"
    aria-hidden="true"
    class="pointer-events-none fixed inset-0 z-[50] h-full w-full"
  />
</template>
