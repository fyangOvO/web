<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { getVersePoem, type PoemData } from '../../api';
import { useI18n } from '../../composables/useI18n';

const { $t } = useI18n();

const poem = ref<PoemData | null>(null);
const loading = ref(true);
const failed = ref(false);

async function load(force = false) {
  loading.value = true;
  failed.value = false;
  try {
    const d = await getVersePoem(force);
    if (!d?.content) throw new Error('empty');
    poem.value = d;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

const source = computed(() => {
  const p = poem.value;
  if (!p) return '';
  const who = p.author || $t('verse.anonymous');
  return p.origin ? `${who} · 《${p.origin}》` : who;
});

onMounted(() => load());
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-violet-500/10 p-6 ring-1 ring-slate-900/5 dark:ring-white/10"
  >
    <span
      class="pointer-events-none absolute -right-3 -top-6 select-none font-serif text-[7rem] leading-none text-cyan-500/10"
      aria-hidden="true"
    >
      &ldquo;
    </span>

    <div class="relative flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-bold">
        <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
          <AppIcon name="book" class="size-3.5" />
        </span>
        {{ $t('verse.poemToday') }}
      </h3>
      <button
        type="button"
        class="grid size-7 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/60 hover:text-cyan-600 dark:hover:bg-white/10 dark:hover:text-cyan-400"
        :aria-label="$t('verse.anotherPoem')"
        @click="load(true)"
      >
        <AppIcon name="refresh-cw" class="size-3.5" />
      </button>
    </div>

    <div v-if="loading" class="mt-4 space-y-2.5">
      <div class="skeleton h-4 w-full rounded-md" />
      <div class="skeleton h-4 w-2/3 rounded-md" />
    </div>

    <p v-else-if="failed" class="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
      <AppIcon name="x" class="size-3.5" />
      {{ $t('verse.failed') }}
    </p>

    <template v-else-if="poem">
      <p class="mt-4 text-[15px] leading-relaxed tracking-wide text-slate-700 dark:text-slate-200">
        {{ poem.content }}
      </p>
      <p class="mt-2.5 text-xs text-slate-400">{{ source }}</p>
    </template>

    <RouterLink
      to="/verse"
      class="relative mt-4 flex items-center gap-1 text-xs font-medium text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-400"
    >
      {{ $t('verse.title') }}
      <AppIcon name="arrow-right" class="size-3" />
    </RouterLink>
  </section>
</template>
