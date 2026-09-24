<script setup lang="ts">
/**
 * FluxButton — WebGL flux-capsule 液态玻璃胶囊按钮。
 * 域扭曲 FBM 噪声驱动的彩色云雾，跟随主题色，悬停加速。
 * 灵感：shuke-lab-flux (https://github.com/KTBOY/shuke-lab-flux)
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

defineProps<{
  variant?: 'primary' | 'ghost';
}>();

const emit = defineEmits<{
  click: [e: MouseEvent];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const btnRef = ref<HTMLButtonElement | null>(null);

/* ---------- GLSL ---------- */
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uHover;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform float uSeed;
uniform float uIsDark;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.55;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = rot * p * 2.0 + 3.7;
    amp *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;
  float t = uTime;
  vec2 q = vec2(fbm(p + t * vec2(0.6, 0.2)),
                fbm(p + t * vec2(-0.4, 0.5) + 5.2));
  vec2 r = vec2(fbm(p + 2.2 * q + t * vec2(0.3, -0.4) + 1.7),
                fbm(p + 2.2 * q + t * vec2(-0.2, 0.3) + 8.3));
  float f = fbm(p + 2.4 * r);
  vec3 col = mix(uC1, uC2, smoothstep(0.15, 0.62, f));
  col = mix(col, uC3, smoothstep(0.60, 0.95, clamp(q.x * 1.3, 0.0, 1.0)));
  col += 0.18 * r.y * uC2;
  col = mix(col, col * col * 1.2 + col * 0.1, uHover * 0.5);

  float colorZone = smoothstep(0.28, 0.82, uv.x + 0.12 * (q.y - 0.5));
  float density = smoothstep(0.30, 0.88, f + 0.25 * r.x);
  float mask = clamp(colorZone * density * 0.9 + colorZone * 0.08, 0.0, 1.0);

  // 浅色主题：彩色更突出，底色偏浅灰；深色主题：彩色保留，底色偏深灰
  vec3 lightBase = vec3(0.94);      // 浅灰（不是纯白）
  vec3 darkBase  = vec3(0.22);      // 深灰
  vec3 base = mix(lightBase, darkBase, uIsDark);

  // 主输出：彩色云雾 + 背景（减少白色混入，让颜色更饱和）
  vec3 outCol = mix(base, col, mask);

  // 顶部渐变：浅色主题顶部稍微加白，深色主题顶部加亮（iOS 胶囊风格）
  float topFade = smoothstep(0.55, 1.05, uv.y);
  vec3 topLight = mix(base + 0.04, col * 0.8, mask);
  outCol = mix(outCol, topLight, topFade * 0.18 * uIsDark);
  outCol = mix(outCol, outCol + 0.05, topFade * 0.35 * (1.0 - uIsDark));

  gl_FragColor = vec4(outCol, 1.0);
}
`;

/* ---------- 主题色 → RGB 0~1 ---------- */
function hexToGlsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const palette = computed(() => {
  const styles = getComputedStyle(document.documentElement);
  const a1 = styles.getPropertyValue('--accent-1').trim() || '#06b6d4';
  const a2 = styles.getPropertyValue('--accent-2').trim() || '#2563eb';
  const isDark = document.documentElement.classList.contains('dark') ? 1 : 0;
  return {
    c1: hexToGlsl(a1),
    c2: hexToGlsl(a2),
    c3: hexToGlsl(a1),
    isDark,
  };
});

/* ---------- WebGL 渲染 ---------- */
interface Renderer {
  gl: WebGLRenderingContext;
  uRes: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uHover: WebGLUniformLocation | null;
  uC1: WebGLUniformLocation | null;
  uC2: WebGLUniformLocation | null;
  uC3: WebGLUniformLocation | null;
  uSeed: WebGLUniformLocation | null;
  uIsDark: WebGLUniformLocation | null;
}

let renderer: Renderer | null = null;
let rafId = 0;
let hover = 0;
let hoverTarget = 0;
let flowTime = 0;
let stir = 0;
let lastX: number | null = null;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}

function setupGL(): Renderer | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  return {
    gl,
    uRes: U('uRes'),
    uTime: U('uTime'),
    uHover: U('uHover'),
    uC1: U('uC1'),
    uC2: U('uC2'),
    uC3: U('uC3'),
    uSeed: U('uSeed'),
    uIsDark: U('uIsDark'),
  };
}

function resize() {
  const canvas = canvasRef.value;
  const btn = btnRef.value;
  if (!canvas || !btn || !renderer) return;
  const rect = btn.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  renderer.gl.uniform2f(renderer.uRes!, canvas.width, canvas.height);
}

let ro: ResizeObserver | null = null;
let lastFrameTime = 0;

function loop(time: number) {
  if (!renderer) return;
  const dt = Math.min(0.05, (time - lastFrameTime) / 1000 || 0.016);
  lastFrameTime = time;

  // 悬停缓动
  hover += (hoverTarget - hover) * Math.min(1, dt * 2.2);
  // 搅动能量衰减
  stir *= Math.pow(0.02, dt);

  const speed = 0.22 + hover * 0.28 + stir * 0.3;
  flowTime += dt * speed;

  renderer.gl.uniform1f(renderer.uTime!, flowTime);
  renderer.gl.uniform1f(renderer.uHover!, hover);
  renderer.gl.drawArrays(renderer.gl.TRIANGLES, 0, 3);

  rafId = requestAnimationFrame(loop);
}

/* ---------- 主题色变化时更新 uniform ---------- */
function updatePalette() {
  if (!renderer) return;
  const { c1, c2, c3, isDark } = palette.value;
  renderer.gl.uniform3fv(renderer.uC1!, c1);
  renderer.gl.uniform3fv(renderer.uC2!, c2);
  renderer.gl.uniform3fv(renderer.uC3!, c3);
  renderer.gl.uniform1f(renderer.uIsDark!, isDark);
}

/* ---------- 事件 ---------- */
function onEnter() { hoverTarget = 1; }
function onLeave() { hoverTarget = 0; lastX = null; }
function onMove(e: MouseEvent) {
  if (lastX !== null) {
    const move = Math.hypot(e.clientX - lastX, e.clientY - (onMove as any)._lastY);
    stir = Math.min(1, stir + move * 0.012);
  }
  lastX = e.clientX;
  (onMove as any)._lastY = e.clientY;
}

onMounted(() => {
  renderer = setupGL();
  if (!renderer) return;
  updatePalette();
  resize();
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(loop);

  const btn = btnRef.value!;
  btn.addEventListener('mouseenter', onEnter);
  btn.addEventListener('mouseleave', onLeave);
  btn.addEventListener('mousemove', onMove);

  ro = new ResizeObserver(resize);
  ro.observe(btn);

  // 主题变化时更新颜色
  const mo = new MutationObserver(updatePalette);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
  (onMounted as any)._mo = mo;
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  ro?.disconnect();
  const mo = (onMounted as any)._mo as MutationObserver | undefined;
  mo?.disconnect();
  const btn = btnRef.value;
  if (btn) {
    btn.removeEventListener('mouseenter', onEnter);
    btn.removeEventListener('mouseleave', onLeave);
    btn.removeEventListener('mousemove', onMove);
  }
});

watch(palette, updatePalette, { deep: true });
</script>

<template>
  <button
    ref="btnRef"
    :class="[
      'flux-btn group relative overflow-hidden rounded-full font-semibold',
      variant === 'ghost' ? 'flux-btn-ghost' : 'flux-btn-primary',
    ]"
    type="button"
    @click="emit('click', $event)"
  >
    <!-- WebGL flux-capsule 画布 -->
    <canvas ref="canvasRef" class="flux-canvas absolute inset-0 h-full w-full" />

    <!-- 轻量磨砂层：浅色主题用深色半透明，深色主题用白色半透明，让彩色云雾更突出 -->
    <div class="flux-overlay pointer-events-none absolute inset-0 bg-slate-900/20 dark:bg-white/15 backdrop-blur-[1px]" />

    <!-- iOS 风格顶部高光 -->
    <div class="flux-highlight pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-full bg-gradient-to-b from-white/50 to-transparent dark:from-white/30" />

    <!-- 体积阴影 -->
    <div class="flux-shadow pointer-events-none absolute inset-0 rounded-full" />

    <!-- 文字层：浅色主题深字，深色主题白字，加阴影增强对比度 -->
    <span class="flux-label relative z-10 flex items-center gap-2 px-6 py-3 text-[0.95rem] font-semibold text-slate-800 dark:text-white drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.flux-btn {
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow:
    0 6px 20px -6px rgba(15, 23, 42, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.flux-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 10px 28px -8px rgba(15, 23, 42, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.flux-btn:active {
  transform: translateY(0);
}

.flux-highlight { pointer-events: none; }
.flux-shadow {
  box-shadow: inset 0 -2px 6px rgba(15, 23, 42, 0.1);
  pointer-events: none;
}

.dark .flux-btn {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.dark .flux-shadow {
  box-shadow: inset 0 -2px 6px rgba(0, 0, 0, 0.2);
}
</style>
