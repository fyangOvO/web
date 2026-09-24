<script setup lang="ts">
/**
 * 桌面歌词窗（Desktop Lyrics 风格）
 *
 * 交互设计：
 * - **常态**：完全透明 —— 无边框、无背景、无标题栏，只有歌词悬浮在页面之上，
 *   文字带描边 + 阴影，保证在任意背景上都能看清（类似网易云桌面歌词）。
 * - **鼠标移入**：淡入玻璃背景 + 圆角容器 + 标题栏（含设置入口）。
 * - **鼠标移出**：淡出，回到纯净歌词。
 * - **拖动**：鼠标按住歌词区域即可拖动（无需先悬停出标题栏）。
 *
 * 可配置（存 localStorage）：
 * - 字体大小 fontSize（14~34px）
 * - 颜色 colorMode：'theme'（跟随主题色）| 'custom'（自选色）
 * - 自定义颜色 customColor
 * - 逐字 / 整句高亮 karaoke
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { useMusic } from '../../composables/useMusic';
import { useI18n } from '../../composables/useI18n';

const {
  currentSong,
  lyricLines,
  currentLyricIndex,
  currentCharIndex,
  lyricWindowVisible,
  toggleLyricWindow,
} = useMusic();
const { $t } = useI18n();

/* ================= 位置 ================= */
const winLeft = ref(24);
const winTop = ref<number | null>(null);
const collapsed = ref(localStorage.getItem('lyric_collapsed') === '1');
watch(collapsed, (v) => localStorage.setItem('lyric_collapsed', v ? '1' : '0'));

/* ================= 悬停 / 拖动 ================= */
/** 鼠标是否在歌词窗内（决定是否显示背景与设置） */
const hovered = ref(false);
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragStartL = 0;
let dragStartT = 0;
let movedDuringDrag = false;

function startDrag(e: PointerEvent) {
  if (e.button !== 0) return;
  // 点在按钮/滑块/输入上时不触发拖动
  const el = e.target as HTMLElement;
  if (el.closest('button, input, select, [data-no-drag]')) return;
  dragging.value = true;
  movedDuringDrag = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartL = winLeft.value;
  dragStartT = winTop.value ?? window.innerHeight - 260;
  if (winTop.value === null) winTop.value = dragStartT;
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
}

function moveDrag(e: PointerEvent) {
  if (!dragging.value) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dx) + Math.abs(dy) > 4) movedDuringDrag = true;
  const w = winW.value;
  const h = winH.value;
  winLeft.value = Math.max(8, Math.min(window.innerWidth - w - 8, dragStartL + dx));
  winTop.value = Math.max(8, Math.min(window.innerHeight - h - 8, dragStartT + dy));
}

function endDrag(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
}

function onDblClick(e: MouseEvent) {
  if (movedDuringDrag) return;
  // 双击按钮/滑块/设置面板时不触发折叠
  const el = e.target as HTMLElement;
  if (el.closest('button, input, select, [data-no-drag]')) return;
  collapsed.value = !collapsed.value;
}

/* ================= 外观设置 ================= */
const SETTINGS_KEY = 'lyric_settings_v2';
interface LyricSettings {
  fontSize: number;
  colorMode: 'theme' | 'custom';
  customColor: string;
  karaoke: boolean;
}
function loadSettings(): LyricSettings {
  const fallback: LyricSettings = {
    fontSize: 20,
    colorMode: 'theme',
    customColor: '#38bdf8',
    karaoke: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      // 兼容旧 key：lyric_karaoke
      const legacy = localStorage.getItem('lyric_karaoke');
      if (legacy === '0') fallback.karaoke = false;
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<LyricSettings>;
    return {
      fontSize: typeof parsed.fontSize === 'number'
        ? Math.min(34, Math.max(14, parsed.fontSize)) : fallback.fontSize,
      colorMode: parsed.colorMode === 'custom' ? 'custom' : 'theme',
      customColor: typeof parsed.customColor === 'string' && /^#[0-9a-f]{6}$/i.test(parsed.customColor)
        ? parsed.customColor : fallback.customColor,
      karaoke: parsed.karaoke !== false,
    };
  } catch {
    return fallback;
  }
}
const settings = ref<LyricSettings>(loadSettings());
watch(settings, (v) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));
  // 同步旧 key，避免其它地方读取到不一致
  localStorage.setItem('lyric_karaoke', v.karaoke ? '1' : '0');
}, { deep: true });

const karaoke = computed(() => settings.value.karaoke);
/** 设置面板是否展开 */
const settingsOpen = ref(false);

/** 已唱部分颜色（主色） */
const sungColor = computed(() =>
  settings.value.colorMode === 'custom'
    ? settings.value.customColor
    : 'rgb(var(--accent-1-rgb))',
);
/** 未唱部分颜色（半透明，保证层次） */
const restColor = computed(() =>
  settings.value.colorMode === 'custom'
    ? hexToRgba(settings.value.customColor, 0.42)
    : 'rgba(148, 163, 184, 0.72)',
);

/** #RRGGBB -> rgba(r,g,b,a) */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 预设色板 */
const PRESETS = ['#38bdf8', '#22c55e', '#f472b6', '#f59e0b', '#a78bfa', '#ef4444', '#0ea5e9', '#14b8a6'];

/* ================= 布局尺寸 ================= */
const WIN_W = 360;
const NEAR = 2;

/** 行高随字号缩放 */
const lineH = computed(() => Math.round(settings.value.fontSize * 2 + 4));
const VIEW_H = computed(() => Math.round(lineH.value * 6));

const winW = computed(() => WIN_W);
const winH = computed(() => (collapsed.value ? 64 : VIEW_H.value + 20));

/** 展开模式的歌词列表 + 逐字切片 */
const lines = computed(() => {
  const idx = currentLyricIndex.value;
  const arr = lyricLines.value;
  if (idx < 0 || !arr.length) return [];
  const start = Math.max(0, idx - NEAR);
  const end = Math.min(arr.length, idx + NEAR + 1);
  return arr.slice(start, end).map((line, i) => {
    const gi = start + i;
    return {
      key: `${line.time}_${gi}`,
      text: line.text,
      isCurrent: gi === idx,
      offset: gi - idx,
      sung: gi === idx ? _slice(line.text, true) : '',
      rest: gi === idx ? _slice(line.text, false) : '',
    };
  });
});

/** 取「已唱 / 未唱」切片 */
function _slice(text: string, sung: boolean): string {
  if (!karaoke.value) return sung ? '' : text;
  const ci = currentCharIndex.value;
  const chars = Array.from(text);
  if (sung) {
    if (ci < 0) return '';
    return chars.slice(0, Math.min(ci + 1, chars.length)).join('');
  }
  if (ci < 0) return text;
  return chars.slice(Math.min(ci + 1, chars.length)).join('');
}

/** 当前句居中位移 */
const trackOffset = computed(() => {
  const list = lines.value;
  if (!list.length) return 0;
  const curIdx = list.findIndex((l) => l.isCurrent);
  if (curIdx < 0) return 0;
  return VIEW_H.value / 2 - lineH.value / 2 - curIdx * lineH.value;
});

/** 每行字号：当前句最大，相邻句次之，外围最小 */
function lineFontSize(offset: number): string {
  const base = settings.value.fontSize;
  if (offset === 0) return `${base}px`;
  if (Math.abs(offset) === 1) return `${Math.round(base * 0.78)}px`;
  return `${Math.round(base * 0.66)}px`;
}

/* ================= 定位 ================= */
function initPosition() {
  if (winTop.value === null) {
    winTop.value = Math.max(8, window.innerHeight - (winH.value + 40));
  }
}
function onResize() {
  initPosition();
  if (winTop.value !== null) {
    winLeft.value = Math.min(winLeft.value, Math.max(8, window.innerWidth - winW.value - 8));
    winTop.value = Math.min(winTop.value, Math.max(8, window.innerHeight - winH.value - 8));
  }
}
onMounted(() => {
  initPosition();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => window.removeEventListener('resize', onResize));

watch(collapsed, () => {
  if (winTop.value !== null) {
    winTop.value = Math.min(winTop.value, Math.max(8, window.innerHeight - winH.value - 8));
  }
});

/** 字体大小变化时重新夹紧位置（高度变了） */
watch(() => settings.value.fontSize, () => {
  if (winTop.value !== null) {
    winTop.value = Math.min(winTop.value, Math.max(8, window.innerHeight - winH.value - 8));
  }
});

/** 鼠标移出时收起设置面板，避免面板「粘」在屏幕上 */
watch(hovered, (v) => {
  if (!v) settingsOpen.value = false;
});
</script>

<template>
  <Transition name="lyric-fade">
    <div
      v-if="lyricWindowVisible"
      class="lyric-root fixed z-40 select-none"
      :class="{ 'is-hovered': hovered || dragging }"
      :style="{
        left: `${winLeft}px`,
        top: winTop !== null ? `${winTop}px` : 'auto',
        width: `${winW}px`,
      }"
      @pointerenter="hovered = true"
      @pointerleave="hovered = false"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @dblclick="onDblClick"
    >
      <!-- ============ 标题栏（仅悬停时显示） ============ -->
      <header class="lyric-header">
        <div class="flex min-w-0 items-center gap-2 text-xs font-medium">
          <AppIcon name="music" class="size-3.5 shrink-0" />
          <span class="truncate">{{ currentSong?.name || $t('lyric.noSong') }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-0.5" data-no-drag>
          <button
            type="button"
            :aria-label="settingsOpen ? $t('lyric.settingsOpen') : $t('lyric.settingsClose')"
            :title="settingsOpen ? $t('lyric.settingsOpen') : $t('lyric.fontSizeTitle')"
            class="lyric-btn"
            :class="settingsOpen ? 'lyric-btn--on' : ''"
            @click.stop="settingsOpen = !settingsOpen"
          >
            <AppIcon name="settings" class="size-3.5" />
          </button>
          <button
            type="button"
            :aria-label="karaoke ? $t('lyric.karaokeOn') : $t('lyric.karaokeOff')"
            :title="karaoke ? $t('lyric.karaokeOnTitle') : $t('lyric.karaokeOffTitle')"
            class="lyric-btn"
            :class="karaoke ? 'lyric-btn--on' : ''"
            @click.stop="settings.karaoke = !settings.karaoke"
          >
            <AppIcon name="type" class="size-3.5" />
          </button>
          <button
            type="button"
            :aria-label="collapsed ? $t('lyric.expandLyric') : $t('lyric.collapseLyric')"
            :title="collapsed ? $t('lyric.expand') : $t('lyric.collapseLine')"
            class="lyric-btn"
            @click.stop="collapsed = !collapsed"
          >
            <AppIcon :name="collapsed ? 'maximize' : 'minimize'" class="size-3.5" />
          </button>
          <button
            type="button"
            :aria-label="$t('lyric.closeWindow')"
            :title="$t('lyric.closeWindow')"
            class="lyric-btn lyric-btn--danger"
            @click.stop="toggleLyricWindow"
          >
            <AppIcon name="close" class="size-3.5" />
          </button>
        </div>
      </header>

      <!-- ============ 设置面板（仅悬停 + 展开时显示） ============ -->
      <Transition name="settings-drop">
        <div v-if="settingsOpen && hovered" class="lyric-settings" data-no-drag>
          <!-- 字体大小 -->
          <div class="flex items-center gap-2">
            <span class="w-11 shrink-0 text-[11px] opacity-70">{{ $t('lyric.fontSize') }}</span>
            <AppIcon name="type" class="size-3 shrink-0 opacity-60" />
            <input
              type="range"
              min="14"
              max="34"
              step="1"
              :value="settings.fontSize"
              class="lyric-range flex-1"
              :style="{ accentColor: sungColor }"
              @input="settings.fontSize = Number(($event.target as HTMLInputElement).value)"
            />
            <span class="w-8 shrink-0 text-right text-[11px] tabular-nums opacity-70">
              {{ settings.fontSize }}
            </span>
          </div>

          <!-- 颜色模式 -->
          <div class="flex items-center gap-2">
            <span class="w-11 shrink-0 text-[11px] opacity-70">{{ $t('lyric.color') }}</span>
            <div class="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                class="lyric-color-chip"
                :class="settings.colorMode === 'theme' ? 'lyric-color-chip--on' : ''"
                :title="$t('lyric.followTheme')"
                :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
                @click="settings.colorMode = 'theme'"
              >
                <AppIcon
                  v-if="settings.colorMode === 'theme'"
                  name="check"
                  class="size-3 text-white drop-shadow"
                />
                <AppIcon
                  v-else
                  name="palette"
                  class="size-3 text-white/90 drop-shadow"
                />
              </button>
              <div class="flex items-center gap-1">
                <button
                  v-for="c in PRESETS"
                  :key="c"
                  type="button"
                  class="lyric-color-chip"
                  :class="settings.colorMode === 'custom' && settings.customColor === c
                    ? 'lyric-color-chip--on' : ''"
                  :style="{ background: c }"
                  :title="c"
                  @click="settings.colorMode = 'custom'; settings.customColor = c"
                >
                  <AppIcon
                    v-if="settings.colorMode === 'custom' && settings.customColor === c"
                    name="check"
                    class="size-3 text-white drop-shadow"
                  />
                </button>
                <label
                  class="lyric-color-chip lyric-color-chip--picker"
                  :class="settings.colorMode === 'custom'
                    && !PRESETS.includes(settings.customColor) ? 'lyric-color-chip--on' : ''"
                  :title="$t('lyric.customColor')"
                >
                  <input
                    type="color"
                    class="sr-only"
                    :value="settings.customColor"
                    @input="settings.colorMode = 'custom'; settings.customColor = ($event.target as HTMLInputElement).value"
                  />
                  <AppIcon name="palette" class="size-3" />
                </label>
              </div>
            </div>
          </div>

          <p class="text-[10px] leading-relaxed opacity-55">
            {{ $t('lyric.hint') }}
          </p>
        </div>
      </Transition>

      <!-- ============ 歌词主体 ============ -->
      <!-- 折叠模式：仅当前句 -->
      <div v-if="collapsed" class="px-3 py-2 text-center">
        <p
          v-if="currentLyricIndex >= 0"
          class="truncate font-bold"
          :style="{ fontSize: `${settings.fontSize}px` }"
        >
          <span :style="{ color: sungColor }">{{ _slice(lyricLines[currentLyricIndex]?.text || '', true) }}</span><span :style="{ color: restColor }">{{ _slice(lyricLines[currentLyricIndex]?.text || '', false) }}</span>
        </p>
        <p v-else class="text-sm opacity-60">♪ ♪ ♪</p>
      </div>

      <!-- 展开模式 -->
      <div
        v-else
        class="relative overflow-hidden px-4"
        :style="{ height: `${VIEW_H + 20}px` }"
      >
        <!-- 上下渐隐（仅在显示背景时明显） -->
        <div class="lyric-fade-mask lyric-fade-mask--top" />
        <div class="lyric-fade-mask lyric-fade-mask--bottom" />

        <div
          v-if="!lyricLines.length"
          class="grid h-full place-items-center text-center text-xs opacity-60"
        >
          {{ currentSong ? $t('lyric.noLyrics') : $t('lyric.searchSong') }}
        </div>

        <div
          v-else
          class="flex flex-col items-center pt-2.5 transition-transform duration-500 ease-out will-change-transform"
          :style="{ transform: `translateY(${trackOffset}px)` }"
        >
          <p
            v-for="item in lines"
            :key="item.key"
            class="lyric-line flex shrink-0 items-center justify-center text-center leading-tight"
            :class="item.isCurrent ? 'lyric-line--current' : ''"
            :style="{
              height: `${lineH}px`,
              fontSize: lineFontSize(item.offset),
              opacity: item.isCurrent ? 1 : (Math.abs(item.offset) === 1 ? 0.72 : 0.42),
            }"
          >
            <!-- 当前句：逐字双色 -->
            <span v-if="item.isCurrent && karaoke" class="px-1 font-bold">
              <span :style="{ color: sungColor }">{{ item.sung }}</span><span :style="{ color: restColor }">{{ item.rest }}</span>
            </span>
            <!-- 当前句：整句高亮 -->
            <span
              v-else-if="item.isCurrent"
              class="px-1 font-bold"
              :style="{ color: sungColor }"
            >{{ item.text }}</span>
            <!-- 其他句 -->
            <span v-else class="px-1">{{ item.text }}</span>
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ============================================================
 * 桌面歌词风格
 * 常态：完全透明（无背景/无边框/无标题栏）
 * 悬停：淡入玻璃背景 + 圆角 + 标题栏
 * 文字用描边 + 阴影保证任意背景可读
 * ============================================================ */

.lyric-root {
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  box-shadow: none;
  transition: background-color 0.22s ease, box-shadow 0.22s ease,
    border-color 0.22s ease, padding 0.22s ease;
  cursor: grab;
}
.lyric-root:active {
  cursor: grabbing;
}
/* 悬停态：出现玻璃背景与边框 */
.lyric-root.is-hovered {
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  box-shadow: 0 18px 48px -14px rgba(2, 6, 23, 0.28), 0 4px 14px -6px rgba(2, 6, 23, 0.14);
}
:global(.dark) .lyric-root.is-hovered {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.78);
}

/* ---------- 标题栏：仅悬停时出现 ---------- */
.lyric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 0;
  padding: 0 10px;
  overflow: hidden;
  opacity: 0;
  color: #334155;
  transition: height 0.22s ease, opacity 0.22s ease, padding 0.22s ease;
}
:global(.dark) .lyric-header {
  color: #e2e8f0;
}
.lyric-root.is-hovered .lyric-header {
  height: 34px;
  padding: 0 10px;
  opacity: 1;
}

/* ---------- 标题栏按钮 ---------- */
.lyric-btn {
  display: inline-grid;
  place-items: center;
  padding: 3px;
  border-radius: 6px;
  color: rgb(100 116 139);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.lyric-btn:hover {
  background: rgba(var(--accent-1-rgb), 0.14);
  color: rgb(15 23 42);
}
:global(.dark) .lyric-btn:hover {
  color: #fff;
}
.lyric-btn--on {
  color: rgb(var(--accent-1-rgb));
}
.lyric-btn--danger:hover {
  background: rgba(244, 63, 94, 0.14);
  color: rgb(225 29 72);
}

/* ---------- 设置面板 ---------- */
.lyric-settings {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0 8px 8px;
  padding: 10px 12px;
  border-radius: 12px;
  color: rgb(51 65 85);
  background: rgba(var(--accent-1-rgb), 0.07);
  border: 1px solid rgba(var(--accent-1-rgb), 0.16);
}
:global(.dark) .lyric-settings {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.lyric-range {
  height: 4px;
  border-radius: 9999px;
  cursor: pointer;
}

/* 颜色选择小圆块 */
.lyric-color-chip {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.lyric-color-chip:hover {
  transform: scale(1.12);
}
.lyric-color-chip--on {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(var(--accent-1-rgb), 0.7);
}
:global(.dark) .lyric-color-chip--on {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px rgba(var(--accent-1-rgb), 0.7);
}
.lyric-color-chip--picker {
  position: relative;
  overflow: hidden;
  color: rgb(100 116 139);
  background: conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171);
}

/* ---------- 歌词行：常态描边保证可读 ---------- */
.lyric-line {
  transition: opacity 0.3s ease, font-size 0.25s ease, color 0.2s ease;
  /* 常态（透明背景）下用描边 + 阴影保证在任意页面上可读 */
  text-shadow:
    0 0 1px rgba(255, 255, 255, 0.9),
    0 0 3px rgba(255, 255, 255, 0.85),
    0 1px 3px rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.12);
}
:global(.dark) .lyric-line {
  text-shadow:
    0 0 2px rgba(2, 6, 23, 0.9),
    0 0 5px rgba(2, 6, 23, 0.8),
    0 1px 3px rgba(0, 0, 0, 0.6);
}

/* 悬停出现背景后，描边收弱一点（避免发糊） */
.lyric-root.is-hovered .lyric-line {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
}
:global(.dark) .lyric-root.is-hovered .lyric-line {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* 非当前句用中性色，避免半透明背景衬托不足 */
.lyric-line:not(.lyric-line--current) {
  color: rgb(71 85 105);
}
:global(.dark) .lyric-line:not(.lyric-line--current) {
  color: rgb(203 213 225);
}

/* ---------- 上下渐隐遮罩：仅在有背景时显示 ---------- */
.lyric-fade-mask {
  position: absolute;
  inset-inline: 0;
  height: 34px;
  z-index: 10;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease;
}
.lyric-fade-mask--top {
  top: 0;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.92), transparent);
}
.lyric-fade-mask--bottom {
  bottom: 0;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.92), transparent);
}
:global(.dark) .lyric-fade-mask--top {
  background: linear-gradient(to bottom, rgba(15, 23, 42, 0.92), transparent);
}
:global(.dark) .lyric-fade-mask--bottom {
  background: linear-gradient(to top, rgba(15, 23, 42, 0.92), transparent);
}
.lyric-root.is-hovered .lyric-fade-mask {
  opacity: 1;
}

/* ---------- 动画 ---------- */
.lyric-fade-enter-active,
.lyric-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.lyric-fade-enter-from,
.lyric-fade-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.settings-drop-enter-active,
.settings-drop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.settings-drop-enter-from,
.settings-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .lyric-root,
  .lyric-header,
  .lyric-fade-mask,
  .lyric-line {
    transition: none;
  }
}
</style>
