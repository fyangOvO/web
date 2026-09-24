<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

const { $t } = useI18n();
const visible = ref(false);
const THRESHOLD = 400;

function onScroll() {
  visible.value = window.scrollY > THRESHOLD;
}

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <Transition name="pop">
    <button
      v-if="visible"
      type="button"
      :aria-label="$t('common.backToTop')"
      class="fixed bottom-6 right-6 z-50 grid size-12 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-110"
      :style="{
        background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
        boxShadow: '0 10px 30px -8px rgba(var(--accent-1-rgb), 0.55)',
      }"
      @click="toTop"
    >
      <AppIcon name="arrow-up" class="size-5" />
    </button>
  </Transition>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}
</style>
