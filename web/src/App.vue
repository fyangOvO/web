<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import AppNavbar from './components/layout/AppNavbar.vue';
import AppFooter from './components/layout/AppFooter.vue';
import AnimatedBackground from './components/ui/AnimatedBackground.vue';
import BackToTop from './components/ui/BackToTop.vue';
import MusicFloatingBall from './components/ui/MusicFloatingBall.vue';
import MusicLyricWindow from './components/ui/MusicLyricWindow.vue';
import SiteCompanion from './components/ui/SiteCompanion.vue';
import ToastContainer from './components/ui/ToastContainer.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
import { useSettings } from './composables/useSettings';
import { useMusic } from './composables/useMusic';
import { useFontLoader } from './composables/useFontLoader';
import { setLang } from './composables/useI18n';

const route = useRoute();
const { fancyButtons, siteLanguage, loaded } = useSettings();
const { initMusic } = useMusic();

const isAdmin = computed(() => route.path.startsWith('/admin'));

// 根据站点设置切换 fancy-mode（云雾特效按钮），但 /admin 后台页面不应用
watchEffect(() => {
  document.documentElement.classList.toggle('fancy-mode', fancyButtons.value && !isAdmin.value);
});

// 语言同步：settings 加载完成后同步到 i18n
watchEffect(() => {
  if (loaded.value && siteLanguage.value) {
    setLang(siteLanguage.value);
  }
});

// 初始化单例音乐播放器（音频元素与事件监听）
initMusic();
useFontLoader();
</script>

<template>
  <div
    class="min-h-screen text-slate-800 transition-colors duration-300 dark:text-slate-200"
  >
    <!-- 全页面动态虚化背景：admin 后台页面不显示 -->
    <AnimatedBackground v-if="!isAdmin" />
    <AppNavbar />
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <AppFooter />
    <BackToTop />
    <!-- 音乐悬浮球与歌词窗：admin 后台页面不显示 -->
    <MusicFloatingBall v-if="!isAdmin" />
    <MusicLyricWindow v-if="!isAdmin" />
    <SiteCompanion v-if="!isAdmin" />
    <!-- 全局提示组件（Teleport 到 body，不受 z-index 影响） -->
    <ToastContainer />
    <ConfirmDialog />
  </div>
</template>
