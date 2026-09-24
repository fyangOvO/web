<script setup lang="ts">
/**
 * SiteCompanion — 網頁看板娘（配置驅動版）。
 * 從 useSettings 讀取後台配置：
 *   companionEnabled    是否啟用
 *   companionSkin       角色造型：default/cat/bunny/bear/custom
 *   companionIdleAnim   待機動畫：bob/sway/breathe/none
 *   companionCustomImage 自定義圖片（base64/URL），優先於 skin
 *   companionSays        用戶自定義語氣泡內容（優先於內置）
 *
 * 可拖拽、多狀態動畫、主題跟隨。
 */
import { onBeforeUnmount, onMounted, nextTick, ref, computed } from 'vue';
import { useSettings } from '../../composables/useSettings';
import { buildCompanionVars, getCompanionSkin } from '../../composables/useCompanionSkin';
import AppIcon from './AppIcon.vue';
import { getProfile, type Profile } from '../../api';
import { useI18n } from '../../composables/useI18n';

type PetMood = 'idle' | 'happy' | 'think' | 'wave' | 'sleep';

const {
  companionEnabled,
  companionSkin,
  companionIdleAnim,
  companionIdleAnimImage,
  companionCustomImage,
  companionSays,
} = useSettings();

const { $t } = useI18n();

/** 當前造型定義（未命中回退少女） */
const sk = computed(() => getCompanionSkin(companionSkin.value));

/** 造型 CSS 變量，掛在根節點上供 SVG / 外框消費 */
const skinVars = computed(() => buildCompanionVars(sk.value));

/**
 * 同頁可能掛載多個實例（前台 + 預覽），SVG 的 <defs> id 必須唯一，
 * 否則 gradient 會互相覆蓋，這裡用隨機短串做命名空間。
 */
const NAMESPACE = `cmp${Math.random().toString(36).slice(2, 8)}`;
const uid = (name: string) => `${NAMESPACE}-${name}`;

/** 後台上傳的個人頭像（讀一次即可） */
const profileAvatar = ref('');
onMounted(async () => {
  try {
    const p: Profile | null = await getProfile();
    if (p?.avatar) profileAvatar.value = p.avatar;
  } catch { /* 忽略 */ }
});

/** 是否使用自定義待機動圖（custom idle 優先級最高） */
const useIdleAnimImage = computed(
  () => companionIdleAnim.value === 'custom' && !!companionIdleAnimImage.value,
);
/** 是否使用自定義造型圖（custom skin） */
const useCustomImage = computed(
  () => companionSkin.value === 'custom' && !!companionCustomImage.value,
);
/** 是否顯示個人頭像（avatar skin） */
const useAvatarImage = computed(
  () => companionSkin.value === 'avatar' && !!profileAvatar.value,
);
/**
 * 是否走內置矢量繪製。
 * 注意：avatar 造型在頭像尚未載入時也要 fallback 到矢量角色，
 * 否則會出現「空白一片」的尷尬狀態。
 */
const useDrawnSkin = computed(() => !useIdleAnimImage.value && !useCustomImage.value && !useAvatarImage.value);
/** 最終顯示的圖片（idle 動圖 > 自定義造型 > 個人頭像） */
const finalImage = computed(
  () =>
    (useIdleAnimImage.value && companionIdleAnimImage.value) ||
    (useCustomImage.value && companionCustomImage.value) ||
    (useAvatarImage.value && profileAvatar.value) ||
    '',
);

/** 內置語氣泡 */
const DEFAULT_BUBBLES = computed(() => ({
  idle: [
    $t('companion.bubble.idle1'), $t('companion.bubble.idle2'), $t('companion.bubble.idle3'), $t('companion.bubble.idle4'),
    $t('companion.bubble.idle5'), $t('companion.bubble.idle6'), $t('companion.bubble.idle7'), $t('companion.bubble.idle8'),
  ],
  happy: [$t('companion.bubble.happy1'), $t('companion.bubble.happy2'), $t('companion.bubble.happy3'), $t('companion.bubble.happy4')],
  think: [$t('companion.bubble.think1'), $t('companion.bubble.think2'), $t('companion.bubble.think3')],
  wave: [$t('companion.bubble.wave1'), $t('companion.bubble.wave2'), $t('companion.bubble.wave3')],
  sleep: [$t('companion.bubble.sleep1'), $t('companion.bubble.sleep2'), $t('companion.bubble.sleep3')],
}));

/** 合併自定義語氣泡與內置 */
const BUBBLES = computed(() => {
  const custom = companionSays.value;
  const defs = DEFAULT_BUBBLES.value;
  if (custom.length === 0) return defs;
  // 自定義內容統一當成 idle 狀態的語氣池，同時 happy/wave 也會隨機用到
  return {
    idle: custom,
    happy: [...defs.happy, ...custom],
    think: defs.think,
    wave: [...defs.wave, ...custom],
    sleep: defs.sleep,
  };
});

/** 氣泡未知寬度時的兜底估算（min-width + padding + border） */
const BASE_BUBBLE_W = 154;
/** 氣泡與角色之間的視覺間隙（必須與 CSS 的 8px 保持一致） */
const BUBBLE_GAP = 8;

// ---- 響應式狀態 ----
const collapsed = ref(false);
const mood = ref<PetMood>('idle');
const bubble = ref('');
const bubbleVisible = ref(false);
const dragging = ref(false);
const bubblePosition = ref<'left' | 'right'>('left');
const posX = ref(0);
const posY = ref(0);
/** 喚醒瞬間的回彈動畫標記（短暫 class） */
const wakeUpAnim = ref(false);
/** 點擊後的愛心特效 */
interface HeartBurst { id: number; x: number; y: number; size: number }
const hearts = ref<HeartBurst[]>([]);
let heartSeq = 0;

/** 是否顯示工具列（hover / 拖拽 / 剛互動過短暫顯示） */
const toolsVisible = ref(false);
/** 氣泡元素引用 + 動態水平偏移，用於貼緊角色 */
const bubbleEl = ref<HTMLElement | null>(null);
const bubbleOffsetPx = ref(-(BASE_BUBBLE_W + 8));
const bubbleStyle = computed(() => ({ '--bubble-offset': `${bubbleOffsetPx.value}px` }));

let dragOffsetX = 0;
let dragOffsetY = 0;
let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
/** 無互動計時器：超時進入 sleep */
let idleSleepTimer: ReturnType<typeof setTimeout> | null = null;
/** 自動獨白排程（每次跑完再排下一次，便於拖拽/睡眠時暫停） */
let monologueTimer: ReturnType<typeof setTimeout> | null = null;
/** 工具列自動隱藏 */
let toolsTimer: ReturnType<typeof setTimeout> | null = null;

/** 無互動多久進入睡眠 */
const SLEEP_AFTER_MS = 75_000;
/** 每次獨白後的隨機間隔區間 */
const MONOLOGUE_MIN_MS = 14_000;
const MONOLOGUE_MAX_MS = 26_000;

function clearTimer(t: ReturnType<typeof setTimeout> | null) {
  if (t) clearTimeout(t);
  return null;
}

// ---- 初始化位置 ----
onMounted(() => {
  posX.value = window.innerWidth - 132;
  posY.value = window.innerHeight - 168;

  // 自動獨白（單一時間軸，睡眠/拖拽時自動停）
  scheduleMonologue();

  // 綁定全域互動事件來喚醒 + 重置 sleep 計時器
  window.addEventListener('mousemove', onUserActivity, { passive: true });
  window.addEventListener('touchstart', onUserActivity, { passive: true });
  window.addEventListener('keydown', onUserActivity, { passive: true });
  window.addEventListener('scroll', onUserActivity, { passive: true });
  window.addEventListener('wheel', onUserActivity, { passive: true });
  window.addEventListener('resize', onUserActivity, { passive: true });

  // 首次出場後歡迎
  setTimeout(() => showBubble('wave'), 1200);
  resetIdleSleepTimer();
});

onBeforeUnmount(() => {
  bubbleTimer = clearTimer(bubbleTimer);
  monologueTimer = clearTimer(monologueTimer);
  idleSleepTimer = clearTimer(idleSleepTimer);
  toolsTimer = clearTimer(toolsTimer);
  window.removeEventListener('mousemove', onUserActivity);
  window.removeEventListener('touchstart', onUserActivity);
  window.removeEventListener('keydown', onUserActivity);
  window.removeEventListener('scroll', onUserActivity);
  window.removeEventListener('wheel', onUserActivity);
  window.removeEventListener('resize', onUserActivity);
});

// ---- 用戶活動（喚醒 + 重置計時器） ----
let lastActivityAt = 0;
function onUserActivity() {
  // 節流：滑鼠移動高頻觸發，避免每次重排計時器
  const now = Date.now();
  if (now - lastActivityAt < 1200) return;
  lastActivityAt = now;

  if (mood.value === 'sleep') wakeUp();
  resetIdleSleepTimer();
}

function resetIdleSleepTimer() {
  idleSleepTimer = clearTimer(idleSleepTimer);
  idleSleepTimer = setTimeout(enterSleep, SLEEP_AFTER_MS);
}

function enterSleep() {
  if (mood.value === 'sleep') return;
  mood.value = 'sleep';
  bubbleVisible.value = false;
  bubbleTimer = clearTimer(bubbleTimer);
  scheduleMonologue();
}

function wakeUp() {
  mood.value = 'idle';
  wakeUpAnim.value = true;
  setTimeout(() => { wakeUpAnim.value = false; }, 700);
  showBubble('happy', $t('companion.wakeMsg'));
}

// ---- 心情與語氣泡 ----
/** 自動獨白：每次執行完再依隨機間隔排下一次，睡眠 / 拖拽時自然停住 */
function scheduleMonologue() {
  monologueTimer = clearTimer(monologueTimer);
  const delay = MONOLOGUE_MIN_MS + Math.random() * (MONOLOGUE_MAX_MS - MONOLOGUE_MIN_MS);
  monologueTimer = setTimeout(() => {
    if (mood.value !== 'sleep' && !dragging.value && !collapsed.value && !bubbleVisible.value) {
      pickRandomMood();
    }
    scheduleMonologue();
  }, delay);
}

function pickRandomMood() {
  const moods: PetMood[] = ['idle', 'idle', 'idle', 'idle', 'happy', 'think', 'wave'];
  showBubble(moods[Math.floor(Math.random() * moods.length)]);
}

/** 氣泡停留時間：字越多停越久，最少 3.2s */
function bubbleDuration(text: string) {
  return Math.min(6500, 3200 + text.length * 110);
}

function showBubble(m: PetMood, text?: string) {
  // 強制喚醒（非 sleep 語氣泡）
  if (mood.value === 'sleep' && m !== 'sleep') {
    mood.value = 'idle';
    resetIdleSleepTimer();
  }
  mood.value = m;
  const pool = BUBBLES.value[m] || BUBBLES.value.idle;
  bubble.value = text || pool[Math.floor(Math.random() * pool.length)];

  bubblePosition.value = getBubbleSide();
  bubbleVisible.value = true;
  // 等氣泡渲染出來再量實際寬度，避免長短句造成間距不一致
  nextTick(() => {
    bubbleOffsetPx.value = bubbleOffset(bubbleEl.value);
  });

  bubbleTimer = clearTimer(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubbleVisible.value = false;
    if (mood.value !== 'sleep') mood.value = 'idle';
  }, bubbleDuration(bubble.value));
}

/**
 * 氣泡顯示在哪一側。
 * 注意 class 語義：`left` 表示氣泡放在角色左邊（角色貼右牆時用），
 * `right` 表示放在角色右邊。默認角色在右下角 → 應為 `left`。
 */
function getBubbleSide(): 'left' | 'right' {
  const petCenter = posX.value + PET_W / 2;
  return petCenter > window.innerWidth / 2 ? 'left' : 'right';
}

/**
 * 氣泡的水平偏移量（px，相對 root 左邊緣）。
 * 用固定的 -238px 會讓氣泡離角色很遠（實測 77px 空白），
 * 這裡改成「按元素自身寬度 + 固定間隙」反推，氣泡永遠緊貼角色。
 */
function bubbleOffset(el: HTMLElement | null): number {
  const w = el?.offsetWidth || BASE_BUBBLE_W;
  return -(w + BUBBLE_GAP);
}

// ---- 點擊 ----
function onClickPet(e: MouseEvent) {
  if (dragging.value) return;
  spawnHearts(e);
  const moods: PetMood[] = ['happy', 'wave', 'think'];
  showBubble(moods[Math.floor(Math.random() * moods.length)]);
  flashTools();
}
function onDoubleClickPet() {
  showBubble('happy', $t('companion.loveMsg'));
  spawnHearts();
}

/** 從點擊處冒出一顆愛心 */
function spawnHearts(e?: MouseEvent) {
  const rect = rootEl.value?.getBoundingClientRect();
  const x = e && rect ? e.clientX - rect.left : PET_W / 2;
  const y = e && rect ? e.clientY - rect.top : PET_H / 2;
  for (let i = 0; i < 3; i++) {
    hearts.value.push({
      id: ++heartSeq,
      x: x + (Math.random() - 0.5) * 34,
      y: y + (Math.random() - 0.5) * 18,
      size: 12 + Math.random() * 9,
    });
  }
  const snapshot = [...hearts.value];
  setTimeout(() => {
    const ids = new Set(snapshot.map((h) => h.id));
    hearts.value = hearts.value.filter((h) => !ids.has(h.id));
  }, 1200);
}

// ---- 拖拽 ----
const rootEl = ref<HTMLElement | null>(null);
/** 角色本體尺寸（與 CSS 保持一致，用於拖拽邊界計算） */
const PET_W = 96;
const PET_H = 120;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  dragging.value = true;
  dragOffsetX = e.clientX - posX.value;
  dragOffsetY = e.clientY - posY.value;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  document.body.style.userSelect = 'none';
  // 拖拽時隱藏氣泡，避免擋視線
  bubbleVisible.value = false;
  flashTools();
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  const rect = rootEl.value?.getBoundingClientRect();
  const w = rect?.width || PET_W;
  const h = rect?.height || PET_H;
  posX.value = Math.max(8, Math.min(e.clientX - dragOffsetX, window.innerWidth - w - 8));
  posY.value = Math.max(8, Math.min(e.clientY - dragOffsetY, window.innerHeight - h - 8));
}
function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  document.body.style.userSelect = '';
  try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  flashTools();
}

/** 互動後短暫露出工具列（觸屏 / 鍵盤用戶也能看到） */
function flashTools() {
  toolsVisible.value = true;
  toolsTimer = clearTimer(toolsTimer);
  toolsTimer = setTimeout(() => {
    if (!dragging.value) toolsVisible.value = false;
  }, 2600);
}

function toggleCollapse() {
  collapsed.value = !collapsed.value;
  if (!collapsed.value) showBubble('happy', $t('companion.returnMsg'));
}
function doWave() { showBubble('wave'); spawnHearts(); }
</script>

<template>
  <div
    ref="rootEl"
    class="companion-root"
    v-show="companionEnabled"
    :class="{
      collapsed,
      dragging,
      [`mood-${mood}`]: true,
      [`skin-${companionSkin}`]: true,
      'wake-up': wakeUpAnim,
      'tools-on': toolsVisible,
    }"
    :style="{ left: `${posX}px`, top: `${posY}px`, ...skinVars }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @mouseenter="toolsVisible = true"
    @mouseleave="!dragging && (toolsVisible = false)"
  >
    <!-- 語氣泡 -->
    <Transition name="bubble">
      <div
        v-if="bubbleVisible && !collapsed"
        ref="bubbleEl"
        class="bubble"
        :class="bubblePosition"
        :style="bubbleStyle"
      >
        <span class="bubble-text">{{ bubble }}</span>
        <span class="bubble-tail" />
      </div>
    </Transition>

    <!-- 點擊愛心特效 -->
    <div class="heart-layer" aria-hidden="true">
      <AppIcon
        v-for="h in hearts"
        :key="h.id"
        name="heart"
        class="pet-heart"
        :style="{ left: `${h.x}px`, top: `${h.y}px`, width: `${h.size}px`, height: `${h.size}px` }"
      />
    </div>

    <!-- 本體 -->
    <div
      class="pet-body"
      :class="{ 'is-img': !useDrawnSkin }"
      @click="onClickPet"
      @dblclick="onDoubleClickPet"
    >

      <!-- 自定義待機動圖（最高優先級，整個替代） -->
      <img
        v-if="useIdleAnimImage"
        class="pet-idle-img"
        :class="`mood-${mood}`"
        :src="companionIdleAnimImage"
        :alt="$t('companion.alt')"
        draggable="false"
      />

      <!-- 自定義造型圖 / 個人頭像 -->
      <img
        v-else-if="useCustomImage || useAvatarImage"
        class="pet-custom-img"
        :class="`idle-${companionIdleAnim}`"
        :src="finalImage"
        :alt="$t('companion.alt')"
        draggable="false"
      />

      <!-- 內置矢量角色（分層繪製：光環 → 地面陰影 → 尾巴 → 耳朵 → 後髮 →
           臉 → 手臂 → 前髮 → 五官 → 道具） -->
      <svg
        v-else
        class="pet-svg"
        :class="[`idle-${companionIdleAnim}`, `shape-${companionSkin}`]"
        :style="skinVars"
        viewBox="0 0 120 150"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- 臉部徑向漸層，中心偏左上，做出球面感 -->
          <radialGradient :id="uid('face')" cx="38%" cy="30%" r="78%">
            <stop offset="0%" :stop-color="sk.skin" />
            <stop offset="72%" :stop-color="sk.skin" />
            <stop offset="100%" :stop-color="sk.skinShade" />
          </radialGradient>
          <!-- 頭髮線性漸層，左上高光 → 右下暗部 -->
          <linearGradient :id="uid('hair')" x1="10%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" :stop-color="sk.hairHi" />
            <stop offset="38%" :stop-color="sk.hair" />
            <stop offset="100%" :stop-color="sk.hairShade" />
          </linearGradient>
          <!-- 衣服漸層 -->
          <linearGradient :id="uid('dress')" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" :stop-color="sk.dressHi" />
            <stop offset="55%" :stop-color="sk.dress" />
            <stop offset="100%" :stop-color="sk.hairShade" />
          </linearGradient>
          <!-- 柔光暈（跟隨主題色） -->
          <radialGradient :id="uid('halo')" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--accent-1)" stop-opacity="0.26" />
            <stop offset="60%" stop-color="var(--accent-2)" stop-opacity="0.12" />
            <stop offset="100%" stop-color="var(--accent-2)" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- ① 背後柔光暈 -->
        <ellipse cx="60" cy="74" rx="48" ry="46" :fill="`url(#${uid('halo')})`" class="pet-halo" />

        <!-- ② 地面陰影（隨待機動畫壓扁） -->
        <ellipse class="pet-ground" cx="60" cy="142" rx="26" ry="5.5" fill="#0f172a" opacity="0.16" />

        <!-- ③ 尾巴（狐狸/熊/貓/兔各有形態） -->
        <g class="pet-tail">
          <template v-if="companionSkin === 'fox'">
            <path
              d="M92 108 C114 104 120 88 108 78 C114 92 102 100 90 100 Z"
              :fill="`url(#${uid('dress')})`"
            />
            <path d="M108 78 C113 85 112 93 107 97 C110 90 110 83 108 78 Z" fill="#FFF6EC" opacity="0.95" />
          </template>
          <template v-else-if="companionSkin === 'cat'">
            <path
              d="M90 112 C108 112 112 96 104 88"
              fill="none"
              :stroke="`url(#${uid('hair')})`"
              stroke-width="9"
              stroke-linecap="round"
            />
          </template>
          <template v-else-if="companionSkin === 'bunny'">
            <circle cx="102" cy="116" r="8" :fill="sk.hair" />
            <circle cx="103" cy="115" r="3.5" fill="#ffffff" opacity="0.75" />
          </template>
          <template v-else-if="companionSkin === 'panda' || companionSkin === 'bear'">
            <circle cx="98" cy="120" r="7" :fill="sk.hairShade" />
          </template>
        </g>

        <!-- ④ 耳朵（在頭之後，先畫） -->
        <g class="pet-ears">
          <template v-if="companionSkin === 'cat' || companionSkin === 'fox'">
            <path
              d="M31 54 C25 40 26 26 34 21 C41 28 43 40 42 50 Z"
              :fill="`url(#${uid('hair')})`"
            />
            <path d="M34 49 C31 39 32 31 36 27 C39 33 39 42 38 48 Z" :fill="sk.earInner" opacity="0.85" />
            <path
              d="M89 54 C95 40 94 26 86 21 C79 28 77 40 78 50 Z"
              :fill="`url(#${uid('hair')})`"
            />
            <path d="M86 49 C89 39 88 31 84 27 C81 33 81 42 82 48 Z" :fill="sk.earInner" opacity="0.85" />
          </template>
          <template v-else-if="companionSkin === 'bunny'">
            <ellipse cx="44" cy="28" rx="8.5" ry="24" :fill="sk.hair" transform="rotate(-9 44 28)" />
            <ellipse cx="44" cy="28" rx="4.2" ry="16" :fill="sk.earInner" opacity="0.9" transform="rotate(-9 44 28)" />
            <ellipse cx="76" cy="28" rx="8.5" ry="24" :fill="sk.hair" transform="rotate(9 76 28)" />
            <ellipse cx="76" cy="28" rx="4.2" ry="16" :fill="sk.earInner" opacity="0.9" transform="rotate(9 76 28)" />
          </template>
          <template v-else-if="companionSkin === 'panda'">
            <circle cx="33" cy="30" r="11.5" :fill="sk.hair" />
            <circle cx="87" cy="30" r="11.5" :fill="sk.hair" />
            <circle cx="33" cy="30" r="5" :fill="sk.earInner" opacity="0.7" />
            <circle cx="87" cy="30" r="5" :fill="sk.earInner" opacity="0.7" />
          </template>
          <template v-else-if="companionSkin === 'bear'">
            <circle cx="33" cy="32" r="11" :fill="`url(#${uid('hair')})`" />
            <circle cx="87" cy="32" r="11" :fill="`url(#${uid('hair')})`" />
            <circle cx="33" cy="32" r="5.5" :fill="sk.earInner" opacity="0.9" />
            <circle cx="87" cy="32" r="5.5" :fill="sk.earInner" opacity="0.9" />
          </template>
          <template v-else>
            <!-- default：小巧人類耳 -->
            <ellipse cx="30" cy="72" rx="4.5" ry="6.5" :fill="sk.skin" />
            <ellipse cx="90" cy="72" rx="4.5" ry="6.5" :fill="sk.skin" />
            <path d="M30 69 C28 71 28 74 30 75" fill="none" :stroke="sk.skinShade" stroke-width="1.1" stroke-linecap="round" />
            <path d="M90 69 C92 71 92 74 90 75" fill="none" :stroke="sk.skinShade" stroke-width="1.1" stroke-linecap="round" />
          </template>
        </g>

        <!-- ⑤ 後髮（垂到肩下的大輪廓） -->
        <path
          class="pet-hair-back"
          d="M22 70 C20 38 37 18 60 18 C83 18 100 38 98 70 C97 88 92 99 84 104 C86 88 84 74 80 64 C72 58 48 58 40 64 C36 74 34 88 36 104 C28 99 23 88 22 70 Z"
          :fill="`url(#${uid('hair')})`"
        />

        <!-- ⑥ 手臂（左手在身後，右手在身前） -->
        <g class="pet-arm-back">
          <path
            d="M43 100 C38 108 35 118 36 124"
            fill="none"
            :stroke="`url(#${uid('dress')})`"
            stroke-width="11"
            stroke-linecap="round"
          />
          <circle cx="36" cy="125" r="6" :fill="sk.skin" />
        </g>

        <!-- ⑦ 身體 / 連衣裙 -->
        <path
          class="pet-dress"
          d="M45 97 C42 103 34 130 32 138 C43 143 77 143 88 138 C86 130 78 103 75 97 C64 93 56 93 45 97 Z"
          :fill="`url(#${uid('dress')})`"
        />
        <!-- 領口 + 蝴蝶結 -->
        <path d="M51 95 C55 101 65 101 69 95 C65 92 55 92 51 95 Z" fill="#ffffff" opacity="0.85" />
        <g class="pet-bow">
          <path d="M60 99 C55 95 48 95 47 100 C48 105 55 104 60 101 Z" fill="var(--accent-1)" opacity="0.92" />
          <path d="M60 99 C65 95 72 95 73 100 C72 105 65 104 60 101 Z" fill="var(--accent-1)" opacity="0.92" />
          <circle cx="60" cy="100" r="2.6" :fill="sk.earInner" />
        </g>
        <!-- 裙擺亮部 -->
        <path d="M48 112 C58 116 70 115 76 111 C74 122 68 130 60 133 C52 130 47 122 48 112 Z" fill="#ffffff" opacity="0.16" />

        <!-- ⑧ 右手（身前，揮手時擺動） -->
        <g class="pet-arm-front">
          <path
            d="M76 101 C82 109 86 119 86 126"
            fill="none"
            :stroke="`url(#${uid('dress')})`"
            stroke-width="11"
            stroke-linecap="round"
          />
          <circle cx="87" cy="128" r="6.2" :fill="sk.skin" />
        </g>

        <!-- ⑨ 臉 -->
        <ellipse cx="60" cy="69" rx="32" ry="33.5" :fill="`url(#${uid('face')})`" />
        <!-- 下巴柔和陰影 -->
        <path d="M34 74 C38 94 82 94 86 74 C82 90 38 90 34 74 Z" fill="#000000" opacity="0.05" />

        <!-- ⑩ 前髮 / 劉海 -->
        <path
          class="pet-hair-front"
          d="M27 66 C25 40 40 22 60 22 C80 22 95 40 93 66 C91 54 85 44 78 39 C74 50 66 57 58 58 C66 50 70 42 71 34 C62 44 50 50 38 50 C34 56 30 60 27 66 Z"
          :fill="`url(#${uid('hair')})`"
        />
        <!-- 側邊髮束高光 -->
        <path d="M32 52 C31 41 37 32 45 28" fill="none" :stroke="sk.hairHi" stroke-width="3" stroke-linecap="round" opacity="0.75" />
        <path d="M88 52 C89 41 83 32 75 28" fill="none" :stroke="sk.hairHi" stroke-width="2.4" stroke-linecap="round" opacity="0.5" />
        <!-- 呆毛 -->
        <path class="pet-ahoge" d="M59 22 C58 12 63 6 69 5 C64 10 63 16 65 22 Z" :fill="sk.hair" />

        <!-- ⑪ 腮紅 -->
        <g class="pet-blush">
          <ellipse cx="41" cy="79" rx="7.5" ry="4.8" :fill="sk.blush" opacity="0.5" />
          <ellipse cx="79" cy="79" rx="7.5" ry="4.8" :fill="sk.blush" opacity="0.5" />
        </g>

        <!-- ⑫ 眼睛：睜眼 / 笑眼 / 睡眼 -->
        <g class="pet-eyes">
          <template v-if="mood === 'happy' || mood === 'sleep'">
            <path d="M36 71 C40 66 46 66 50 71" fill="none" :stroke="sk.eye" stroke-width="2.4" stroke-linecap="round" />
            <path d="M70 71 C74 66 80 66 84 71" fill="none" :stroke="sk.eye" stroke-width="2.4" stroke-linecap="round" />
          </template>
          <template v-else>
            <!-- 左眼 -->
            <ellipse class="pet-eye-l" cx="43" cy="71" rx="6.4" ry="7.6" :fill="sk.eye" />
            <ellipse cx="41" cy="68" rx="2.4" ry="2.8" fill="#ffffff" opacity="0.95" />
            <circle cx="45.6" cy="74.4" r="1.5" fill="#ffffff" opacity="0.7" />
            <!-- 右眼 -->
            <ellipse class="pet-eye-r" cx="77" cy="71" rx="6.4" ry="7.6" :fill="sk.eye" />
            <ellipse cx="75" cy="68" rx="2.4" ry="2.8" fill="#ffffff" opacity="0.95" />
            <circle cx="79.6" cy="74.4" r="1.5" fill="#ffffff" opacity="0.7" />
          </template>
        </g>

        <!-- ⑬ 眉毛（思考時微微內收；位置貼近髮際，避免壓眼） -->
        <g class="pet-brows" :class="{ 'brows-think': mood === 'think' }">
          <path d="M36 58.5 C39.5 56.6 46 56.6 49 58.5" fill="none" :stroke="sk.hairShade" stroke-width="1.6" stroke-linecap="round" opacity="0.8" />
          <path d="M71 58.5 C74 56.6 80.5 56.6 84 58.5" fill="none" :stroke="sk.hairShade" stroke-width="1.6" stroke-linecap="round" opacity="0.8" />
        </g>

        <!-- ⑭ 嘴巴 -->
        <g class="pet-mouth">
          <path
            v-if="mood === 'happy' || mood === 'wave'"
            d="M55 85 C57 90 63 90 65 85"
            fill="none"
            :stroke="sk.eye"
            stroke-width="2"
            stroke-linecap="round"
          />
          <ellipse v-else-if="mood === 'sleep'" cx="60" cy="87" rx="3.2" ry="4" :fill="sk.eye" opacity="0.55" />
          <path
            v-else-if="mood === 'think'"
            d="M56 87 C58 85 62 85 64 87"
            fill="none"
            :stroke="sk.eye"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            v-else
            d="M57 86 C58.5 88 61.5 88 63 86"
            fill="none"
            :stroke="sk.eye"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </g>

        <!-- ⑮ 萌系鼻子（走獸造型才有；放在人中偏上，與嘴巴留出呼吸感） -->
        <path
          v-if="companionSkin !== 'default'"
          d="M57.6 81.6 C58.4 80.2 61.6 80.2 62.4 81.6 C61.6 83 58.4 83 57.6 81.6 Z"
          :fill="sk.earInner"
          opacity="0.9"
        />

        <!-- ⑯ 睡眠：Zzz 氣泡（在角色右上，不遮臉） -->
        <g v-if="mood === 'sleep'" class="pet-zzz">
          <circle cx="94" cy="42" r="8" fill="#ffffff" opacity="0.9" />
          <text x="94" y="46" font-size="9" font-weight="700" text-anchor="middle" fill="#94a3b8">z</text>
          <circle cx="106" cy="26" r="6" fill="#ffffff" opacity="0.85" />
          <text x="106" y="30" font-size="8" font-weight="700" text-anchor="middle" fill="#94a3b8">z</text>
          <circle cx="114" cy="13" r="4.5" fill="#ffffff" opacity="0.75" />
        </g>

        <!-- ⑰ 思考：小氣泡 -->
        <g v-if="mood === 'think'" class="pet-think">
          <circle cx="100" cy="48" r="3" fill="#ffffff" opacity="0.9" />
          <circle cx="108" cy="38" r="4.6" fill="#ffffff" opacity="0.85" />
        </g>
      </svg>

      <!-- 摺疊狀態：變成一顆可拖動的頭像膠囊 -->
      <button v-if="collapsed" class="pet-collapsed" :title="$t('companion.expandBtn')" @click.stop="toggleCollapse">
        <svg viewBox="0 0 40 40" class="size-8" aria-hidden="true">
          <ellipse cx="20" cy="36" rx="11" ry="2.4" fill="#0f172a" opacity="0.14" />
          <!-- 後髮 -->
          <path d="M6 21 C6 9 12 3 20 3 C28 3 34 9 34 21 C34 27 32 31 29 33 C30 27 29 22 27 19 C23 16 17 16 13 19 C11 22 10 27 11 33 C8 31 6 27 6 21 Z" :fill="sk.hairShade" />
          <!-- 耳朵 -->
          <path d="M10 12 L9 4 L16 9 Z" :fill="sk.hair" />
          <path d="M30 12 L31 4 L24 9 Z" :fill="sk.hair" />
          <!-- 臉 -->
          <ellipse cx="20" cy="21" rx="11.5" ry="12" :fill="sk.skin" />
          <!-- 前髮 -->
          <path d="M8.5 19 C8 10.5 13 5 20 5 C27 5 32 10.5 31.5 19 C30.5 14 28 10.5 25.5 8.5 C24 12.5 21 15 17.5 15.5 C20 12.5 21.5 9.5 22 6.5 C18 10.5 13 12.5 8.5 19 Z" :fill="sk.hair" />
          <!-- 眼睛（都是笑眼） -->
          <path d="M13.5 21.5 C15 19.2 17.2 19.2 18.7 21.5" fill="none" :stroke="sk.eye" stroke-width="1.7" stroke-linecap="round" />
          <path d="M21.3 21.5 C22.8 19.2 25 19.2 26.5 21.5" fill="none" :stroke="sk.eye" stroke-width="1.7" stroke-linecap="round" />
          <!-- 腮紅 -->
          <ellipse cx="12" cy="25.5" rx="2.8" ry="1.8" :fill="sk.blush" opacity="0.5" />
          <ellipse cx="28" cy="25.5" rx="2.8" ry="1.8" :fill="sk.blush" opacity="0.5" />
          <!-- 嘴巴 -->
          <path d="M18.5 27 C19.4 28.4 20.6 28.4 21.5 27" fill="none" :stroke="sk.eye" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- 工具列 -->
    <div v-if="!collapsed" class="toolbar">
      <button class="tool-btn" :title="$t('companion.greet')" @click.stop="doWave">
        <AppIcon name="sparkle" class="size-3" />
      </button>
      <button class="tool-btn" :title="$t('companion.rest')" @click.stop="enterSleep()">
        <AppIcon name="moon" class="size-3" />
      </button>
      <button class="tool-btn" :title="$t('companion.collapseTitle')" @click.stop="toggleCollapse">
        <AppIcon name="chevrons-left" class="size-3" />
      </button>
    </div>

    <!-- 展開按鈕 -->
    <button v-if="collapsed" class="expand-btn" :title="$t('companion.expandTitle')" @click.stop="toggleCollapse">
      <AppIcon name="sparkle" class="size-4" />
    </button>
  </div>
</template>

<style scoped>
.companion-root {
  position: fixed;
  z-index: 60;
  color: var(--accent-1);
  touch-action: none;
  user-select: none;
}
.companion-root.dragging .pet-body { cursor: grabbing; filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.25)); }

/* ====== 語氣泡 ====== */
.bubble {
  position: absolute;
  top: -30px;
  min-width: 122px;
  max-width: 224px;
  padding: 11px 15px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 18px 18px 18px 6px;
  box-shadow:
    0 12px 28px -8px rgba(15, 23, 42, 0.2),
    0 2px 6px rgba(15, 23, 42, 0.06);
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
  font-weight: 500;
  letter-spacing: 0.2px;
  transform-origin: bottom center;
}
.bubble.right { border-radius: 18px 18px 6px 18px; }
/* 水平位置由 --bubble-offset 驅動（= 氣泡自身寬度 + 8px 間隙），
   這樣短句不會留出大片空白，長句也不會壓到角色 */
.bubble.left  { left: var(--bubble-offset, -162px); transform-origin: bottom right; }
.bubble.right { right: var(--bubble-offset, -162px); transform-origin: bottom left; }
.bubble-tail {
  position: absolute;
  bottom: 12px;
  width: 11px;
  height: 11px;
  background: rgba(255, 255, 255, 0.94);
}
.bubble.left  .bubble-tail { right: -4px; transform: rotate(45deg); }
.bubble.right .bubble-tail { left:  -4px; transform: rotate(45deg); }

@keyframes bubble-pop {
  0%   { transform: scale(0.55) translateY(12px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

/* ====== 本體 ====== */
.pet-body {
  position: relative;
  width: 96px;
  height: 120px;
  cursor: grab;
  filter: drop-shadow(0 10px 16px rgba(15, 23, 42, 0.16));
  transition: filter 0.3s ease;
}
.companion-root:hover .pet-body { filter: drop-shadow(0 14px 22px rgba(15, 23, 42, 0.22)); }
.pet-body.is-img { cursor: pointer; }
.pet-svg { width: 100%; height: 100%; overflow: visible; }

/* 自定義造型 / 待機動圖 */
.pet-custom-img,
.pet-idle-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 14px;
}
.pet-idle-img.mood-happy { animation: happy-bounce 0.6s ease-in-out 3; }
.pet-idle-img.mood-think { animation: think-tilt 2s ease-in-out infinite; }
.pet-idle-img.mood-sleep { animation: sleep-sway 4s ease-in-out infinite; }

/* ====== 角色內部零件 ====== */
/* 地面陰影：與待機動畫錯峰，營造「離地」的彈性質感 */
.pet-ground {
  transform-box: fill-box;
  transform-origin: center;
  animation: ground-breathe 3s ease-in-out infinite;
}
@keyframes ground-breathe {
  0%, 100% { transform: scaleX(1); opacity: 0.16; }
  50%      { transform: scaleX(0.86); opacity: 0.1; }
}
.pet-halo { animation: halo-breathe 4.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes halo-breathe {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.05); }
}

/* 眨眼：只在非微笑/睡眠狀態生效 */
.pet-eye-l, .pet-eye-r { transform-box: fill-box; transform-origin: center; }
.mood-idle .pet-eye-l, .mood-idle .pet-eye-r,
.mood-think .pet-eye-l, .mood-think .pet-eye-r,
.mood-wave .pet-eye-l, .mood-wave .pet-eye-r {
  animation: blink 4.6s ease-in-out infinite;
}
.pet-eye-r { animation-delay: 0.07s; }
@keyframes blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95%           { transform: scaleY(0.08); }
}

/* 呆毛隨風輕晃 */
.pet-ahoge {
  transform-box: fill-box;
  transform-origin: bottom center;
  animation: ahoge-sway 3.2s ease-in-out infinite;
}
@keyframes ahoge-sway {
  0%, 100% { transform: rotate(-7deg); }
  50%      { transform: rotate(7deg); }
}

/* 尾巴 */
.pet-tail { transform-box: fill-box; transform-origin: left center; animation: tail-sway 3.4s ease-in-out infinite; }
@keyframes tail-sway {
  0%, 100% { transform: rotate(-4deg); }
  50%      { transform: rotate(5deg); }
}

/* 可愛系造型的耳朵會輕輕豎動 */
.shape-cat .pet-ears,
.shape-fox .pet-ears,
.shape-bunny .pet-ears {
  transform-box: fill-box;
  transform-origin: bottom center;
  animation: ear-perk 5s ease-in-out infinite;
}
@keyframes ear-perk {
  0%, 86%, 100% { transform: rotate(0deg); }
  90%           { transform: rotate(-3deg); }
  94%           { transform: rotate(2deg); }
}

/* 腮紅：呼吸式若隱若現 */
.pet-blush { animation: blush-breathe 3.6s ease-in-out infinite; }
@keyframes blush-breathe {
  0%, 100% { opacity: 0.72; }
  50%      { opacity: 1; }
}

/* 眉毛：思考時內收 */
.pet-brows path { transition: transform 0.35s ease, opacity 0.35s ease; transform-box: fill-box; transform-origin: center; }
.brows-think path:first-child { transform: translate(1.5px, 1px) rotate(9deg); }
.brows-think path:last-child  { transform: translate(-1.5px, 1px) rotate(-9deg); }

.pet-zzz, .pet-think { animation: float-soft 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes float-soft {
  0%, 100% { opacity: 0.45; transform: translateY(0) scale(0.96); }
  50%      { opacity: 1; transform: translateY(-5px) scale(1); }
}

/* ====== 點擊愛心 ====== */
.heart-layer { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.pet-heart {
  position: absolute;
  fill: var(--accent-1);
  stroke: none;
  animation: heart-float 1.1s ease-out forwards;
}
@keyframes heart-float {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  22%  { opacity: 1; transform: translate(-50%, -70%) scale(1.12); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(0.8); }
}

/* ====== 摺疊：收成一顆小頭像，整體足跡明顯變小 ====== */
.companion-root.collapsed { width: 46px; height: 46px; }
.pet-collapsed {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  box-shadow: 0 8px 20px -6px rgba(15, 23, 42, 0.24);
  cursor: grab;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease;
}
.pet-collapsed:hover { transform: scale(1.08); box-shadow: 0 12px 26px -6px rgba(15, 23, 42, 0.3); }

/* ====== 待機動畫（由 companionIdleAnim 控制） ====== */
.idle-bob { animation: idle-bob 3s ease-in-out infinite; transform-origin: bottom center; }
@keyframes idle-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-6px) rotate(-0.5deg); }
}
.idle-sway { animation: idle-sway 4.2s ease-in-out infinite; transform-origin: bottom center; }
@keyframes idle-sway {
  0%, 100% { transform: rotate(-3.5deg); }
  50%      { transform: rotate(3.5deg); }
}
.idle-breathe { animation: idle-breathe 3.2s ease-in-out infinite; transform-origin: bottom center; }
@keyframes idle-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.045); }
}
.idle-none { animation: none; }

/* ====== 心情動畫 ====== */
.mood-happy .pet-body { animation: happy-bounce 0.62s ease-in-out 3; }
@keyframes happy-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  30%      { transform: translateY(-15px) scale(1.05); }
  60%      { transform: translateY(0) scale(0.96); }
}
/* 揮手：整隻角色輕跳 + 手臂擺動 */
.mood-wave .pet-body { animation: wave-hop 0.9s ease-in-out infinite; }
@keyframes wave-hop {
  0%, 100% { transform: translateY(0) rotate(-1.5deg); }
  50%      { transform: translateY(-5px) rotate(1.5deg); }
}
.mood-wave .pet-arm-front {
  transform-box: fill-box;
  transform-origin: bottom center;
  animation: wave-arm 0.75s ease-in-out infinite;
}
@keyframes wave-arm {
  0%, 100% { transform: rotate(6deg); }
  50%      { transform: rotate(-26deg); }
}
.mood-think .pet-body { animation: think-tilt 2.4s ease-in-out infinite; transform-origin: bottom center; }
@keyframes think-tilt {
  0%, 100% { transform: rotate(-2deg) translateY(0); }
  50%      { transform: rotate(2.5deg) translateY(-2px); }
}
/* 睡眠：輕微搖擺 + 壓暗 */
.mood-sleep .pet-body {
  animation: sleep-sway 4.4s ease-in-out infinite;
  transform-origin: bottom center;
  opacity: 0.8;
  filter: drop-shadow(0 5px 10px rgba(15, 23, 42, 0.12));
}
.mood-sleep .pet-halo { opacity: 0.4; animation: none; }
.mood-sleep .pet-blush { animation: none; opacity: 0.5; }
@keyframes sleep-sway {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
  50%      { transform: translateY(2.5px) rotate(2deg) scale(0.985); }
}

/* 喚醒瞬間的回彈 */
.wake-up .pet-body,
.wake-up .pet-idle-img,
.wake-up .pet-custom-img {
  animation: wake-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  opacity: 1;
}
@keyframes wake-pop {
  0%   { opacity: 0.8; transform: scale(0.9) translateY(5px); }
  58%  { opacity: 1; transform: scale(1.11) translateY(-9px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* ====== 工具列 ====== */
.toolbar {
  position: absolute;
  /* 內收：角色貼右牆時按鈕不會被視窗邊緣切掉 */
  top: 2px;
  right: 2px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transform: translateX(6px) scale(0.92);
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.companion-root:hover .toolbar,
.companion-root.dragging .toolbar,
.companion-root.tools-on .toolbar {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}
.tool-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 3px 9px -2px rgba(15, 23, 42, 0.22);
  color: #64748b;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.18s ease;
}
.tool-btn:hover { transform: scale(1.16); color: var(--accent-1); }

/* 展開按鈕：疊在膠囊左下角，視覺上「掛」在同一顆頭像上 */
.expand-btn {
  position: absolute;
  left: -6px;
  bottom: -6px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.34);
  animation: pulse-soft 2.4s ease-in-out infinite;
}
@keyframes pulse-soft {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.1); }
}

/* ====== Transition ====== */
.bubble-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.bubble-leave-active { transition: all 0.22s ease; }
.bubble-enter-from { opacity: 0; transform: scale(0.6) translateY(10px); }
.bubble-leave-to   { opacity: 0; transform: scale(0.85) translateY(4px); }

/* 深色主題微調 */
:global(html.dark) .bubble {
  background: rgba(30, 41, 59, 0.94);
  border-color: rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
}
:global(html.dark) .bubble-tail { background: rgba(30, 41, 59, 0.94); }
:global(html.dark) .pet-collapsed,
:global(html.dark) .tool-btn {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(148, 163, 184, 0.28);
  color: #cbd5e1;
}

/* ====== 無障礙：尊重系統的減少動效偏好 ====== */
@media (prefers-reduced-motion: reduce) {
  .pet-svg,
  .pet-body,
  .pet-idle-img,
  .pet-custom-img,
  .pet-ahoge,
  .pet-tail,
  .pet-ears,
  .pet-eye-l,
  .pet-eye-r,
  .pet-halo,
  .pet-ground,
  .pet-blush,
  .pet-zzz,
  .pet-think,
  .pet-arm-front,
  .expand-btn,
  .pet-heart {
    animation: none !important;
  }
}
</style>
