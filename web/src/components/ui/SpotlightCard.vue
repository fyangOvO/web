<script setup lang="ts">
import { ref } from 'vue';

/**
 * Spotlight 卡片：鼠标移动时产生跟随光晕 + 轻微上浮。
 */
const el = ref<HTMLElement | null>(null);

function onMove(e: MouseEvent) {
  const node = el.value;
  if (!node) return;
  const rect = node.getBoundingClientRect();
  node.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  node.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
}

function onLeave() {
  const node = el.value;
  if (!node) return;
  node.style.removeProperty('--spot-x');
  node.style.removeProperty('--spot-y');
}
</script>

<template>
  <div
    ref="el"
    class="spotlight rounded-2xl transition-transform duration-300 hover:-translate-y-1"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <slot />
  </div>
</template>
