<script setup lang="ts">
defineProps<{ shimmer?: boolean }>();
</script>

<template>
  <span :class="shimmer ? 'text-gradient-shimmer' : 'text-gradient'">
    <slot />
  </span>
</template>
