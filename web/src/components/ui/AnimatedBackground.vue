<script setup lang="ts">
/**
 * 全局背景：纯色底 + 柔和主题渐变 + 动态切换的背景效果。
 * 根據後台設置 backgroundType 動態渲染對應背景組件。
 * admin 后台页面不显示背景效果。
 */
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useSettings } from '../../composables/useSettings';
import ClickParticles from './ClickParticles.vue';

const route = useRoute();
const { backgroundType, clickEffectEnabled } = useSettings();
const isAdmin = computed(() => route.path.startsWith('/admin'));

/** 背景組件映射表 */
const bgMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  aurora: defineAsyncComponent(() => import('../backgrounds/AuroraBackground.vue')),
  blackhole: defineAsyncComponent(() => import('../backgrounds/BlackHoleBackground.vue')),
  bubbles: defineAsyncComponent(() => import('../backgrounds/BubblesBackground.vue')),
  'cosmic-portal': defineAsyncComponent(() => import('../backgrounds/CosmicPortalBackground.vue')),
  'falling-stars': defineAsyncComponent(() => import('../backgrounds/FallingStarsBackground.vue')),
  'flickering-grid': defineAsyncComponent(() => import('../backgrounds/FlickeringGridBackground.vue')),
  'interactive-grid': defineAsyncComponent(() => import('../backgrounds/InteractiveGridBackground.vue')),
  lamp: defineAsyncComponent(() => import('../backgrounds/LampBackground.vue')),
  neural: defineAsyncComponent(() => import('../backgrounds/NeuralBackground.vue')),
  pattern: defineAsyncComponent(() => import('../backgrounds/PatternBackground.vue')),
  ribbon: defineAsyncComponent(() => import('../backgrounds/RibbonBackground.vue')),
  silk: defineAsyncComponent(() => import('../backgrounds/SilkBackground.vue')),
  snowfall: defineAsyncComponent(() => import('../backgrounds/SnowfallBackground.vue')),
  tetris: defineAsyncComponent(() => import('../backgrounds/TetrisBackground.vue')),
  'video-text': defineAsyncComponent(() => import('../backgrounds/VideoTextBackground.vue')),
  thunderstorm: defineAsyncComponent(() => import('../backgrounds/ThunderstormBackground.vue')),
  wavy: defineAsyncComponent(() => import('../backgrounds/WavyBackground.vue')),
};

const ActiveBg = computed(() => bgMap[backgroundType.value] || bgMap.aurora);
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <!-- 純色底色 -->
    <div class="absolute inset-0 bg-slate-50 dark:bg-slate-950" />

    <!-- 柔和主题漸變 -->
    <div
      class="absolute inset-0"
      :style="{
        background: `linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.06) 0%, transparent 45%, rgba(var(--accent-2-rgb), 0.06) 100%)`,
      }"
    />

    <!-- 動態背景（admin 頁隱藏） -->
    <component :is="ActiveBg" v-if="!isAdmin && backgroundType !== 'none'" />

    <!-- 點擊粒子特效（admin 頁隱藏；後台總開關關閉時也不掛載） -->
    <ClickParticles v-if="!isAdmin && clickEffectEnabled" />
  </div>
</template>
