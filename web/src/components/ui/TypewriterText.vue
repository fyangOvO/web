<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{ phrases: string[] }>();

const text = ref('');
let timer: number | undefined;
let phraseIndex = 0;
let charIndex = 0;
let deleting = false;

function tick() {
  const current = props.phrases[phraseIndex % props.phrases.length] ?? '';
  if (!deleting) {
    charIndex += 1;
    text.value = current.slice(0, charIndex);
    if (charIndex >= current.length) {
      deleting = true;
      timer = window.setTimeout(tick, 1800);
      return;
    }
    timer = window.setTimeout(tick, 68);
  } else {
    charIndex -= 1;
    text.value = current.slice(0, charIndex);
    if (charIndex <= 0) {
      deleting = false;
      phraseIndex += 1;
      timer = window.setTimeout(tick, 350);
      return;
    }
    timer = window.setTimeout(tick, 34);
  }
}

onMounted(() => {
  if (props.phrases.length > 0) tick();
});
onUnmounted(() => window.clearTimeout(timer));
</script>

<template>
  <span>
    {{ text }}<span class="typewriter-caret" />
  </span>
</template>
