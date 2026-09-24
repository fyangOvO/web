<script setup lang="ts">
defineProps<{ kicker?: string; title?: string; desc?: string }>();
</script>

<template>
  <div v-reveal class="mx-auto mb-12 max-w-2xl text-center">
    <span
      v-if="kicker"
      class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400"
    >
      {{ kicker }}
    </span>
    <h2 class="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
      <slot>{{ title }}</slot>
    </h2>
    <p v-if="desc" class="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">
      {{ desc }}
    </p>
  </div>
</template>
