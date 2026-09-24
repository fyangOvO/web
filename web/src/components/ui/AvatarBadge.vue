<script setup lang="ts">
withDefaults(
  defineProps<{ text: string; image?: string; size?: 'sm' | 'md' | 'lg' }>(),
  { size: 'md' }
);
</script>

<template>
  <span
    class="grid shrink-0 select-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 font-bold text-white shadow-lg shadow-cyan-500/30"
    :class="
      size === 'lg'
        ? 'size-20 text-2xl'
        : size === 'sm'
          ? 'size-8 text-xs'
          : 'size-10 text-base'
    "
  >
    <img
      v-if="image"
      :src="image"
      alt="头像"
      class="size-full object-cover"
    />
    <span v-else>{{ text }}</span>
  </span>
</template>
