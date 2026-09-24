<script setup lang="ts">
/**
 * 音乐精灵球 + 展开面板
 * - 圆形精灵球：上盖主题色（玻璃质感）、下盖浅色、中央圆形按钮 + 高光点
 * - 播放时：整球呼吸缩放 + 两圈错峰呼吸波纹
 * - 可任意拖动；拖到窗口边缘并静置后自动半隐（滑出大半），鼠标移入即复原
 * - 点击（非拖动）切换面板
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { useMusic } from '../../composables/useMusic';
import { useSettings } from '../../composables/useSettings';
import { getSkin, buildPanelStyle } from '../../composables/useMusicSkin';
import { useTheme } from '../../composables/useTheme';
import { useI18n } from '../../composables/useI18n';

const { musicEnabled, musicSkin, musicSkinBg, musicSkinOpacity, musicSkinBlur } = useSettings();
const { isDark } = useTheme();
const { $t, $tFmt } = useI18n();

/* ================= 皮肤 ================= */
const skin = computed(() => getSkin(musicSkin.value));
const pal = computed(() => (isDark.value ? skin.value.dark : skin.value.light));

/** 面板容器样式 */
const panelStyle = computed(() => ({
  top: `${panelTop.value}px`,
  right: `${panelRight.value}px`,
  ...buildPanelStyle({
    skin: skin.value,
    isDark: isDark.value,
    bgImage: musicSkinBg.value,
    opacity: musicSkinOpacity.value,
    blur: musicSkinBlur.value,
  }),
}));

/** 标题栏样式（图片皮肤时用深色蒙层保证可读） */
const headerStyle = computed(() => ({
  background: skin.value.isImage
    ? `linear-gradient(135deg, ${isDark.value ? 'rgba(15,23,42,.55)' : 'rgba(15,23,42,.42)'}, ${isDark.value ? 'rgba(15,23,42,.3)' : 'rgba(15,23,42,.2)'})`
    : skin.value.headerBg,
  color: skin.value.isImage || isDark.value ? '#f8fafc' : undefined,
}));

/** 皮肤下按钮/输入框的通用样式 */
const inputStyle = computed(() => ({
  backgroundColor: pal.value.input,
  borderColor: pal.value.divider,
  color: pal.value.text,
}));
const hoverBg = computed(() => pal.value.hover);

const {
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  searchResults,
  searchKeyword,
  playableMap,
  playableFirst,
  searching,
  loadingTrack,
  errorMsg,
  needsUserGesture,
  playerOpen,
  lyricWindowVisible,
  initMusic,
  search,
  playSong,
  togglePlay,
  next,
  prev,
  seek,
  setVolume,
  togglePlayer,
  toggleLyricWindow,
} = useMusic();

/* ================= 精灵球位置与拖拽 ================= */
const BALL = 52; // 精灵球直径 px
const MARGIN = 6; // 与窗口边缘留白

const ballLeft = ref<number | null>(null);
const ballTop = ref<number | null>(null);
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartL = 0;
let dragStartT = 0;
let moved = false;

/** 贴边半隐状态：'left' | 'right' | null */
const docked = ref<'left' | 'right' | null>(null);
/** 是否已滑出屏幕（半隐） */
const hidden = ref(false);
/** 鼠标悬停时临时取消半隐 */
const hovering = ref(false);
let dockTimer: number | null = null;

const DOCK_DELAY = 2600; // 静置多久后开始半隐（ms）
/** 半隐时露出多少 px */
const PEEK = 16;

function clampPos(l: number, t: number) {
  return {
    l: Math.max(MARGIN, Math.min(window.innerWidth - BALL - MARGIN, l)),
    t: Math.max(MARGIN, Math.min(window.innerHeight - BALL - MARGIN, t)),
  };
}

function centerBall() {
  const l = window.innerWidth - BALL - MARGIN;
  const t = Math.max(MARGIN, window.innerHeight / 2 - BALL / 2);
  ballLeft.value = l;
  ballTop.value = t;
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  clearDockTimer();
  docked.value = null;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartL = ballLeft.value ?? window.innerWidth - BALL - MARGIN;
  dragStartT = ballTop.value ?? window.innerHeight / 2 - BALL / 2;
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
  const p = clampPos(dragStartL + dx, dragStartT + dy);
  ballLeft.value = p.l;
  ballTop.value = p.t;
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  if (!moved) {
    togglePlayer();
    return;
  }
  // 拖动结束：判断是否贴到左右边缘
  scheduleDockIfAtEdge();
}

/** 靠近左右边缘则安排延迟半隐 */
function scheduleDockIfAtEdge() {
  const l = ballLeft.value ?? 0;
  const maxL = window.innerWidth - BALL - MARGIN;
  const nearLeft = l <= MARGIN + 2;
  const nearRight = l >= maxL - 2;
  if (!nearLeft && !nearRight) { docked.value = null; return; }
  docked.value = nearLeft ? 'left' : 'right';
  // 记录贴边基准位
  armDockTimer();
}

function armDockTimer() {
  clearDockTimer();
  hidden.value = false;
  // 鼠标在球上时不倒计时
  if (hovering.value) return;
  dockTimer = window.setTimeout(() => {
    if (docked.value && !hovering.value) hidden.value = true;
  }, DOCK_DELAY);
}

function clearDockTimer() {
  if (dockTimer !== null) { window.clearTimeout(dockTimer); dockTimer = null; }
}

function onBallEnter() {
  hovering.value = true;
  hidden.value = false;
  clearDockTimer();
}
function onBallLeave() {
  hovering.value = false;
  if (docked.value) armDockTimer();
}

/** 精灵球 transform：半隐时向外平移，只露出 PEEK 宽度 */
const ballShift = computed(() => {
  if (!docked.value || !hidden.value || hovering.value) return 0;
  return docked.value === 'left' ? -(BALL - PEEK) : BALL - PEEK;
});

/* ================= 工具 ================= */
function fmt(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

function onSeekInput(e: Event) {
  seek(Number((e.target as HTMLInputElement).value));
}
function onVolumeInput(e: Event) {
  setVolume(Number((e.target as HTMLInputElement).value));
}
function onSearchEnter() {
  void search();
}
function playFromResults(song_idx: number) {
  const song = searchResults.value[song_idx];
  if (song) void playSong(song, searchResults.value);
}

/**
 * 动态配色的悬停高亮。
 * 皮肤色来自运行时计算的 palette，无法写成静态 Tailwind class（如 hover:bg-slate-100），
 * 因此用事件内联设置背景色。抽成命名函数而不是模板内联箭头，
 * 便于类型检查且避免模板里出现过长的表达式。
 */
function onRowEnter(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (el) el.style.backgroundColor = hoverBg.value;
}
function onRowLeave(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (el) el.style.backgroundColor = 'transparent';
}

/* ================= 生命周期 ================= */
function onResize() {
  if (ballLeft.value === null || ballTop.value === null) { centerBall(); return; }
  const p = clampPos(ballLeft.value, ballTop.value);
  ballLeft.value = p.l;
  ballTop.value = p.t;
}

onMounted(() => {
  centerBall();
  initMusic();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  clearDockTimer();
});

/* 面板位置：贴着球垂直居中 */
const panelTop = computed(() => {
  const t = ballTop.value ?? window.innerHeight / 2;
  return Math.max(8, Math.min(window.innerHeight - 420, t - 140));
});
const panelRight = computed(() => {
  const l = ballLeft.value ?? window.innerWidth - BALL - MARGIN;
  return Math.max(12, window.innerWidth - l + 10);
});
</script>

<template>
  <template v-if="musicEnabled">
  <!-- ============ 精灵球 ============ -->
  <div
    v-show="!hidden || hovering"
    class="fixed z-50 select-none"
    :style="{
      left: ballLeft !== null ? `${ballLeft}px` : 'auto',
      top: ballTop !== null ? `${ballTop}px` : '50%',
      width: `${BALL}px`,
      height: `${BALL}px`,
    }"
  >
    <button
      type="button"
      :aria-label="$t('music.playerTitle')"
      class="pokeball group relative block size-full cursor-pointer rounded-full transition-transform duration-300 ease-out"
      :style="{
        transform: `translateX(${ballShift}px) scale(${dragging ? 1.06 : 1})`,
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerenter="onBallEnter"
      @pointerleave="onBallLeave"
    >
      <!-- 呼吸波纹（两圈错峰） -->
      <span v-if="isPlaying" class="pokeball__ripple pokeball__ripple--1" aria-hidden="true" />
      <span v-if="isPlaying" class="pokeball__ripple pokeball__ripple--2" aria-hidden="true" />

      <!-- 球体本体（呼吸缩放作用在这一层，避免与位移 transform 冲突） -->
      <span
        class="pokeball__body"
        :class="{ 'pokeball__body--playing': isPlaying }"
        aria-hidden="true"
      >
        <!-- 上盖高光 -->
        <span class="pokeball__gloss" />
        <!-- 中央按钮 -->
        <span class="pokeball__core">
          <AppIcon
            :name="isPlaying ? 'pause' : 'play'"
            class="pokeball__icon"
          />
        </span>
      </span>
    </button>
  </div>

  <!-- ============ 展开面板 ============ -->
  <Transition name="slide-fade">
    <section
      v-if="playerOpen"
      class="fixed z-40 w-[340px] max-w-[80vw] overflow-hidden rounded-2xl border shadow-2xl"
      :style="panelStyle"
    >
      <!-- 标题栏 -->
      <header
        class="flex items-center justify-between px-4 py-3"
        :style="headerStyle"
      >
        <div class="flex items-center gap-2 text-sm font-semibold">
          <AppIcon name="music" class="size-4" />
          <span>{{ $t('music.playerTitle') }}</span>
        </div>
        <button
          type="button"
          :aria-label="$t('music.close')"
          class="rounded-md p-1 transition-opacity hover:opacity-70"
          :style="{ color: 'inherit' }"
          @click="togglePlayer"
        >
          <AppIcon name="close" class="size-4" />
        </button>
      </header>

      <div class="space-y-3 p-4 text-sm">
        <!-- 搜索框 -->
        <div class="flex gap-2">
          <input
            v-model="searchKeyword"
            type="text"
            :placeholder="$t('music.searchPlaceholder')"
            class="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none placeholder:opacity-60 focus:border-[rgb(var(--accent-1-rgb))]"
            :style="inputStyle"
            @keydown.enter.prevent="onSearchEnter"
          />
          <button
            type="button"
            :disabled="searching"
            class="shrink-0 rounded-md px-3 py-2 text-white transition-opacity disabled:opacity-50"
            :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
            @click="onSearchEnter"
          >
            <AppIcon name="search" class="size-4" />
          </button>
        </div>

        <!-- 可播放优先开关 -->
        <div class="flex items-center justify-between">
          <span class="text-[11px]" :style="{ color: pal.muted }">
            {{ $tFmt('music.songCount', { n: searchResults.length }) }}<span v-if="searchResults.length">，{{ $t('music.playableFirst') }}</span>
          </span>
          <button
            type="button"
            role="switch"
            :aria-checked="playableFirst"
            :title="playableFirst ? $t('music.playableFirstOn') : $t('music.playableFirstOff')"
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors"
            :style="playableFirst
              ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))', color: '#fff' }
              : { color: pal.muted, backgroundColor: pal.hover }"
            @click="playableFirst = !playableFirst"
          >
            <AppIcon name="check" class="size-3" />
            {{ $t('music.playableFirstLabel') }}
          </button>
        </div>

        <!-- 错误 / 加载提示 -->
        <p
          v-if="errorMsg"
          class="flex items-start gap-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <AppIcon name="alert-circle" class="mt-px size-3.5 shrink-0" />
          <span>{{ errorMsg }}</span>
        </p>
        <p v-if="searching" class="text-xs" :style="{ color: pal.muted }">{{ $t('music.searching') }}</p>
        <p v-if="loadingTrack" class="text-xs" :style="{ color: pal.muted }">{{ $t('music.loadingTrack') }}</p>

        <!-- 自动播放被拦截：给出可点击的解锁入口 -->
        <button
          v-if="needsUserGesture && currentSong && !isPlaying"
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-white transition-transform hover:scale-[1.02]"
          :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
          @click="togglePlay"
        >
          <AppIcon name="play" class="size-3.5" />
          {{ $tFmt('music.clickToResume', { name: currentSong.name }) }}
        </button>

        <!-- 搜索结果 -->        <ul v-if="searchResults.length" class="max-h-56 space-y-1 overflow-y-auto pr-1">
          <li
            v-for="(s, i) in searchResults"
            :key="s.id + i"
            class="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors"
            :class="playableMap[s.id] === false ? 'opacity-55' : ''"
            :style="{ '--row-hover': hoverBg }"
            @mouseenter="onRowEnter"
            @mouseleave="onRowLeave"
            @click="playFromResults(i)"
          >
            <img
              v-if="s.cover"
              :src="s.cover"
              :alt="s.name"
              loading="lazy"
              class="size-9 shrink-0 rounded object-cover"
            />
            <div v-else class="grid size-9 shrink-0 place-items-center rounded" :style="{ backgroundColor: pal.hover, color: pal.muted }">
              <AppIcon name="music" class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 text-xs font-medium" :style="{ color: pal.text }">
                <span class="truncate">{{ s.name }}</span>
                <span
                  v-if="playableMap[s.id] === false"
                  class="shrink-0 rounded px-1 py-px text-[10px] font-normal leading-tight text-amber-700 ring-1 ring-amber-400/60 dark:text-amber-300"
                  :title="$t('music.vipRestricted')"
                >VIP</span>
              </p>
              <p class="truncate text-[11px]" :style="{ color: pal.muted }">{{ s.artist }}</p>
            </div>
            <AppIcon
              v-if="currentSong?.id === s.id && isPlaying"
              name="pause"
              class="size-4 text-[rgb(var(--accent-1-rgb))]"
            />
            <AppIcon
              v-else
              :name="playableMap[s.id] === false ? 'alert-circle' : 'play'"
              class="size-4"
              :class="playableMap[s.id] === false ? 'text-amber-500' : ''"
              :style="playableMap[s.id] === false ? undefined : { color: pal.muted }"
            />
          </li>
        </ul>

        <!-- 当前播放 -->
        <div
          v-if="currentSong"
          class="flex items-center gap-3 rounded-lg border p-2"
          :style="{ borderColor: pal.divider, backgroundColor: pal.hover }"
        >
          <img
            v-if="currentSong.cover"
            :src="currentSong.cover"
            :alt="currentSong.name"
            class="size-11 shrink-0 rounded-md object-cover"
          />
          <div v-else class="grid size-11 shrink-0 place-items-center rounded-md" :style="{ backgroundColor: pal.input, color: pal.muted }">
            <AppIcon name="music" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold" :style="{ color: pal.text }">{{ currentSong.name }}</p>
            <p class="truncate text-xs" :style="{ color: pal.muted }">{{ currentSong.artist }}</p>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="space-y-1">
          <input
            type="range"
            min="0"
            :max="duration || 0"
            :value="currentTime"
            step="0.1"
            class="w-full accent-[rgb(var(--accent-1-rgb))]"
            @input="onSeekInput"
          />
          <div class="flex justify-between text-[11px]" :style="{ color: pal.muted }">
            <span>{{ fmt(currentTime) }}</span>
            <span>{{ fmt(duration) }}</span>
          </div>
        </div>

        <!-- 控制 -->
        <div class="flex items-center justify-between">
          <button
            type="button"
            :aria-label="$t('music.prev')"
            class="rounded-md p-2 transition-colors"
            :style="{ color: pal.muted }"
            @mouseenter="onRowEnter"
            @mouseleave="onRowLeave"
            @click="prev"
          >
            <AppIcon name="skip-back" class="size-5" />
          </button>
          <button
            type="button"
            :aria-label="$t('music.playPause')"
            class="grid size-11 place-items-center rounded-full text-white shadow-md transition-transform hover:scale-105"
            :style="{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' }"
            @click="togglePlay"
          >
            <AppIcon :name="isPlaying ? 'pause' : 'play'" class="size-5" />
          </button>
          <button
            type="button"
            :aria-label="$t('music.next')"
            class="rounded-md p-2 transition-colors"
            :style="{ color: pal.muted }"
            @mouseenter="onRowEnter"
            @mouseleave="onRowLeave"
            @click="next"
          >
            <AppIcon name="skip-forward" class="size-5" />
          </button>
        </div>

        <!-- 音量 + 歌词窗开关 -->
        <div class="flex items-center gap-3">
          <AppIcon name="volume" class="size-4 shrink-0" :style="{ color: pal.muted }" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="volume"
            class="flex-1 accent-[rgb(var(--accent-1-rgb))]"
            @input="onVolumeInput"
          />
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors"
            :style="lyricWindowVisible
              ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))', color: '#fff' }
              : { color: pal.muted, backgroundColor: pal.hover }"
            @click="toggleLyricWindow"
          >
            <AppIcon name="music" class="size-3.5" />
            {{ $t('music.lyricsLabel') }}
          </button>
        </div>
      </div>
    </section>
  </Transition>
  </template>
</template>

<style scoped>
/* ================= 精灵球本体 ================= */
.pokeball__body {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  overflow: hidden;
  /* 玻璃质感：上盖主题色 -> 柔光横带 -> 下盖浅蓝白 */
  background: linear-gradient(
    160deg,
    var(--accent-1) 0%,
    var(--accent-2) 42%,
    rgba(255, 255, 255, 0.28) 47%,
    rgba(255, 255, 255, 0.28) 51%,
    rgba(255, 255, 255, 0.92) 55%,
    #dbeafe 100%
  );
  border: 1.5px solid rgba(15, 23, 42, 0.5);
  box-shadow:
    0 8px 22px -6px rgba(var(--accent-1-rgb), 0.6),
    inset 0 2px 4px rgba(255, 255, 255, 0.65),
    inset 0 -3px 6px rgba(15, 23, 42, 0.12);
  transition: box-shadow 0.3s ease;
}

.dark .pokeball__body {
  border-color: rgba(226, 232, 240, 0.55);
  background: linear-gradient(
    160deg,
    var(--accent-1) 0%,
    var(--accent-2) 42%,
    rgba(255, 255, 255, 0.3) 47%,
    rgba(255, 255, 255, 0.3) 51%,
    rgba(255, 255, 255, 0.85) 55%,
    #cbd5e1 100%
  );
}

/* 上盖高光点 */
.pokeball__gloss {
  position: absolute;
  left: 20%;
  top: 16%;
  width: 30%;
  height: 20%;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.62);
  filter: blur(2.5px);
  pointer-events: none;
}

/* 中央按钮：白底 + 深色环 + 图标 */
.pokeball__core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 46%;
  height: 46%;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow:
    inset 0 0 0 2.5px rgba(15, 23, 42, 0.78),
    inset 0 1px 3px rgba(0, 0, 0, 0.16);
}
.dark .pokeball__core {
  background: #f8fafc;
  box-shadow:
    inset 0 0 0 2.5px rgba(15, 23, 42, 0.82),
    inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 中央图标：跟随主题色深浅，用深色保证在白底上清晰 */
.pokeball__icon {
  width: 52%;
  height: 52%;
  color: rgba(var(--accent-2-rgb), 0.95);
  transition: transform 0.25s ease;
}

/* 悬停放大一点图标 */
.pokeball:hover .pokeball__icon {
  transform: scale(1.08);
}

/* ================= 呼吸（球体缩放） ================= */
.pokeball__body--playing {
  animation: pokeball-breathe 2.4s ease-in-out infinite;
}
@keyframes pokeball-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.075); }
}

/* ================= 呼吸波纹 ================= */
.pokeball__ripple {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: rgba(var(--accent-1-rgb), 0.32);
  pointer-events: none;
  z-index: -1;
}
.pokeball__ripple--1 {
  animation: pokeball-ripple 2.4s ease-out infinite;
}
.pokeball__ripple--2 {
  animation: pokeball-ripple 2.4s ease-out infinite;
  animation-delay: 1.2s;
}
@keyframes pokeball-ripple {
  0%   { transform: scale(1);    opacity: 0.55; }
  70%  { transform: scale(1.85); opacity: 0; }
  100% { transform: scale(1.85); opacity: 0; }
}

/* ================= 面板动画 ================= */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 尊重系统降级 */
@media (prefers-reduced-motion: reduce) {
  .pokeball__body--playing,
  .pokeball__ripple { animation: none; }
}
</style>
