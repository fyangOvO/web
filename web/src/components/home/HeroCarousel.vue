<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Autoplay, EffectFade } from 'swiper/modules';
import AppIcon from '../ui/AppIcon.vue';
import { useSettings } from '../../composables/useSettings';

import 'swiper/css';
import 'swiper/css/effect-fade';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  to: string;
  image?: string;
  /** 背景视频，存在时优先于图片 */
  video?: string;
  gradient: string;
  kind: string;
  sort: number;
  visible: boolean;
  /** 是否显示左上角「博客/随笔/...」分类标签 */
  showKind?: boolean;
  // 文字显示开关
  showTitle: boolean;
  showSubtitle: boolean;
  showDesc: boolean;
  // 主标题样式
  titleSize: number;
  titleWeight: string;
  titleColor: string;
  // 副标题样式
  subtitleSize: number;
  subtitleColor: string;
  // 描述文字样式
  descSize: number;
  descColor: string;
  // 位置控制
  textPosition: string;
  textAlign: string;
  textOffsetY: number;
}

const { carouselPaginate, carouselInterval } = useSettings();

const banners = ref<Banner[]>([]);
const loading = ref(true);

/** 字重映射 */
const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  '900': 900,
};

/** 生成单张 banner 的文字容器样式 */
function bannerTextStyle(b: Banner) {
  return {
    left: b.textPosition === 'left' ? '0' : undefined,
    right: b.textPosition === 'right' ? '0' : undefined,
    marginLeft: b.textPosition === 'center' ? 'auto' : undefined,
    marginRight: b.textPosition === 'center' ? 'auto' : undefined,
    transform: `translateY(${b.textOffsetY}vh)`,
    textAlign: b.textAlign as any,
  };
}

/** 自動播放進度（0~1） */
const progress = ref(0);
/** 當前活動索引 */
const activeIndex = ref(0);

const modules = [Autoplay, EffectFade];

/** 從 settings 讀取自動播放延遲（最少 2000ms） */
const AUTOPLAY_DELAY = Math.max(2000, carouselInterval.value);

/** Swiper 實例引用 */
let swiperInstance: any = null;

/** 動畫幀更新進度條 */
let rafId = 0;
let startTime = 0;
let paused = false;

function tick(now: number) {
  if (!startTime) startTime = now;
  if (paused) {
    startTime = now - progress.value * AUTOPLAY_DELAY;
  }
  const elapsed = now - startTime;
  progress.value = Math.min(1, elapsed / AUTOPLAY_DELAY);
  if (progress.value >= 1) {
    startTime = now;
    progress.value = 0;
    swiperInstance?.slideNext();
  }
  rafId = requestAnimationFrame(tick);
}

function startProgress() {
  stopProgress();
  paused = false;
  startTime = 0;
  rafId = requestAnimationFrame(tick);
}

function stopProgress() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function pauseProgress() {
  paused = true;
}

function resumeProgress() {
  paused = false;
  startTime = performance.now() - progress.value * AUTOPLAY_DELAY;
}

function goToSlide(index: number) {
  swiperInstance?.slideTo(index);
}

function onSwiper(swiper: any) {
  swiperInstance = swiper;
}

function onSlideChange(swiper: any) {
  activeIndex.value = swiper.activeIndex;
  progress.value = 0;
  startTime = performance.now();
}

function scrollDown() {
  window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
}

/** 獲取 kind 對應的標籤文字 */
function kindLabel(kind: string) {
  const map: Record<string, string> = {
    blog: '博客',
    essay: '随笔',
    note: '图文',
    project: '项目',
    custom: '推荐',
  };
  return map[kind] || '推荐';
}

onMounted(async () => {
  try {
    const r = await fetch('/api/banners');
    banners.value = await r.json();
  } catch {
    /* 後端未啟動時保留空態 */
  } finally {
    loading.value = false;
  }
  startProgress();
});

onUnmounted(() => stopProgress());

function onVisibilityChange() {
  if (document.hidden) pauseProgress();
  else resumeProgress();
}
onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange));
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange));
</script>

<template>
  <section
    class="relative h-screen w-full overflow-hidden"
    @mouseenter="pauseProgress"
    @mouseleave="resumeProgress"
  >
    <!-- ============ Swiper 背景 ============ -->
    <div v-if="loading" class="absolute inset-0 bg-slate-900" />

    <Swiper
      v-else-if="banners.length"
      :modules="modules"
      effect="fade"
      :fade-effect="{ crossFade: true }"
      :loop="true"
      :autoplay="{ delay: AUTOPLAY_DELAY, disableOnInteraction: false, pauseOnMouseEnter: false }"
      :speed="900"
      :grab-cursor="false"
      class="absolute inset-0 h-full w-full"
      @swiper="onSwiper"
      @slideChange="onSlideChange"
    >
      <SwiperSlide v-for="b in banners" :key="b.id">
        <!-- 背景層 -->
        <div class="absolute inset-0" :class="`bg-gradient-to-br ${b.gradient}`">
          <!-- 視頻背景：存在時優先於圖片，自動靜音循環（移动端需要 playsinline） -->
          <video
            v-if="b.video"
            :src="b.video"
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
            class="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <!-- 圖片背景：gif/webp anim 透過 img 自動播放 -->
          <img
            v-else-if="b.image"
            :src="b.image"
            :alt="b.title"
            loading="eager"
            class="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <!-- 漸變遮罩 -->
          <div
            class="absolute inset-0"
            :class="(b.image || b.video) ? 'bg-gradient-to-b from-black/40 via-black/20 to-black/75' : 'bg-gradient-to-b from-black/15 via-transparent to-black/60'"
          />
          <!-- 裝飾光點 -->
          <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 40%)" />
        </div>

        <!-- 每張 slide 自己的內容（疊加在背景上） -->
        <RouterLink
          :to="b.to"
          class="absolute inset-0 z-10 flex items-center"
        >
          <div class="shell w-full">
            <div
              class="relative max-w-2xl text-white transition-all duration-700"
              :style="bannerTextStyle(b)"
            >
              <span
                v-if="b.showTitle && b.showKind !== false && b.kind"
                class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md"
              >
                {{ kindLabel(b.kind) }}
              </span>
              <h2
                v-if="b.showTitle && b.title"
                class="mt-4 font-bold leading-tight drop-shadow-lg"
                :style="{
                  fontSize: `${b.titleSize}px`,
                  fontWeight: WEIGHT_MAP[b.titleWeight] ?? 700,
                  color: b.titleColor,
                }"
              >
                {{ b.title }}
              </h2>
              <p
                v-if="b.showSubtitle && b.subtitle"
                class="mt-3 line-clamp-2 max-w-xl leading-relaxed"
                :style="{ fontSize: `${b.subtitleSize}px`, color: b.subtitleColor }"
              >
                {{ b.subtitle }}
              </p>
              <p
                v-if="b.showDesc && b.desc"
                class="mt-2 line-clamp-3 max-w-xl leading-relaxed"
                :style="{ fontSize: `${b.descSize}px`, color: b.descColor }"
              >
                {{ b.desc }}
              </p>
            </div>
          </div>
        </RouterLink>
      </SwiperSlide>
    </Swiper>

    <!-- ============ 頂部進度條 ============ -->
    <div
      v-if="banners.length && carouselPaginate"
      class="pointer-events-none absolute inset-x-0 top-16 z-40 px-4 sm:top-20 sm:px-8"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-2">
        <template v-for="(_, i) in banners" :key="i">
          <div
            class="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm transition-all duration-300"
            :class="i === activeIndex ? 'h-1' : 'opacity-60'"
          >
            <div
              v-if="i === activeIndex"
              class="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              :style="{ width: `${progress * 100}%` }"
            />
            <div
              v-else-if="i < activeIndex"
              class="h-full w-full rounded-full bg-white/70"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- ============ 底部內容指示器 ============ -->
    <div
      v-if="banners.length && carouselPaginate"
      class="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/50 to-transparent px-4 pb-12 pt-20 text-white sm:px-8 md:pb-16"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-6">
        <!-- 小圓點指示 -->
        <div class="flex items-center gap-2">
          <button
            v-for="(b, i) in banners"
            :key="b.id"
            type="button"
            :aria-label="`跳转到第 ${i + 1} 张：${b.title}`"
            class="grid place-items-center transition-all duration-300"
            @click="goToSlide(i)"
          >
            <span
              class="block rounded-full bg-white transition-all duration-300"
              :class="i === activeIndex ? 'h-2 w-8' : 'h-2 w-2 opacity-50 hover:opacity-80'"
            />
          </button>
        </div>

        <!-- 當前標題 -->
        <div class="flex-1 overflow-hidden">
          <p class="truncate text-sm font-medium text-white/90 md:text-base">
            {{ banners[activeIndex]?.title }}
          </p>
        </div>

        <!-- 左右箭頭 -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            aria-label="上一張"
            class="grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20"
            @click="goToSlide(activeIndex - 1)"
          >
            <AppIcon name="chevron-left" class="size-4" />
          </button>
          <button
            type="button"
            aria-label="下一張"
            class="grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20"
            @click="goToSlide(activeIndex + 1)"
          >
            <AppIcon name="chevron-right" class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- ============ 底部向下箭頭 ============ -->
    <button
      v-if="banners.length"
      type="button"
      aria-label="向下滾動"
      class="absolute bottom-4 left-1/2 z-40 grid -translate-x-1/2 place-items-center rounded-full bg-white/15 p-2 text-white backdrop-blur-md transition-all hover:bg-white/25 hover:scale-110 sm:hidden"
      @click="scrollDown"
    >
      <AppIcon name="chevron-down" class="size-4 animate-bounce" />
    </button>
  </section>
</template>

<style scoped>
/* Swiper fade 覆蓋 */
@media (prefers-reduced-motion: reduce) {
  .hero-carousel :deep(.swiper) {
    animation: none;
  }
}
</style>
