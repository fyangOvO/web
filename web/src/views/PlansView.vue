<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import { CATEGORY_EMOJI, CATEGORY_ORDER, type Plan, type PlanCategory } from '../data/plans';
import { usePlans } from '../composables/usePlans';
import { useI18n, type TranslationKey } from '../composables/useI18n';

const { $t } = useI18n();
const { plans: planList, loaded, load } = usePlans();

onMounted(() => load());

const CAT_KEYS: Record<PlanCategory, TranslationKey> = {
  travel: 'plan.cat.travel',
  tech: 'plan.cat.tech',
  game: 'plan.cat.game',
  health: 'plan.cat.health',
  life: 'plan.cat.life',
};

/** 当前筛选分类，null = 全部 */
const activeCat = ref<PlanCategory | null>(null);

const all = computed<Plan[]>(() => planList.value ?? []);

/** 只展示有内容的分类 */
const cats = computed(() => CATEGORY_ORDER.filter((c) => all.value.some((p) => p.category === c)));

const filtered = computed<Plan[]>(() =>
  activeCat.value ? all.value.filter((p) => p.category === activeCat.value) : all.value
);

function catLabel(c: PlanCategory): string {
  return $t(CAT_KEYS[c]);
}
</script>

<template>
  <div class="shell pb-16 pt-28 md:pt-36">
    <!-- 页头 -->
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Plans
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('plan.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('plan.subtitle') }}
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span class="glass rounded-full px-4 py-1.5">{{ all.length }} {{ $t('plan.count') }}</span>
        <span class="glass rounded-full px-4 py-1.5">
          {{ cats.length }} {{ $t('plan.category') }}
        </span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="!loaded" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 3" :key="i" class="glass h-80 animate-pulse rounded-3xl" />
    </div>

    <template v-else>
      <!-- 分类筛选 -->
      <div v-if="cats.length > 1" class="mb-8 flex flex-wrap justify-center gap-2">
      <button
        type="button"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
        :class="
          activeCat === null
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
            : 'glass text-slate-600 hover:-translate-y-0.5 dark:text-slate-300'
        "
        @click="activeCat = null"
      >
        {{ $t('plan.all') }}
      </button>
      <button
        v-for="c in cats"
        :key="c"
        type="button"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
        :class="
          activeCat === c
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
            : 'glass text-slate-600 hover:-translate-y-0.5 dark:text-slate-300'
        "
        @click="activeCat = c"
      >
        <span class="mr-1">{{ CATEGORY_EMOJI[c] }}</span>{{ catLabel(c) }}
      </button>
    </div>

    <!-- 计划卡片 -->
    <div v-if="filtered.length" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="p in filtered"
        :key="p.id"
        v-reveal
        :to="`/plans/${p.id}`"
        class="group glass flex flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
      >
        <!-- 封面 -->
        <div class="relative h-40 overflow-hidden bg-gradient-to-br" :class="p.gradient">
          <div
            class="pointer-events-none absolute -right-4 -top-6 select-none text-[7rem] leading-none opacity-25 transition-transform duration-500 group-hover:scale-110"
            aria-hidden="true"
          >
            {{ p.emoji }}
          </div>
          <div class="relative flex h-full flex-col justify-between p-5 text-white">
            <span
              class="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm"
            >
              <span>{{ CATEGORY_EMOJI[p.category] }}</span>{{ catLabel(p.category) }}
            </span>
            <div>
              <h2 class="text-xl font-bold leading-snug">{{ p.title }}</h2>
              <p class="mt-1 text-xs leading-relaxed text-white/80">{{ p.subtitle }}</p>
            </div>
          </div>
        </div>

        <!-- 正文 -->
        <div class="flex flex-1 flex-col p-5">
          <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ p.summary }}
          </p>

          <!-- 关键数字 -->
          <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <div v-for="m in p.meta.slice(0, 3)" :key="m.label">
              <p class="text-[11px] text-slate-400">{{ m.label }}</p>
              <p class="text-sm font-semibold">{{ m.value }}</p>
            </div>
          </div>

          <!-- 标签 -->
          <div v-if="p.tags.length" class="mt-4 flex flex-wrap gap-1.5">
            <span
              v-for="tag in p.tags"
              :key="tag"
              class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-500 dark:bg-white/10 dark:text-slate-400"
            >
              {{ tag }}
            </span>
          </div>

          <div
            class="mt-5 flex items-center gap-1.5 border-t border-slate-200 pt-4 text-sm font-medium text-cyan-600 transition-all duration-300 group-hover:gap-2.5 dark:border-slate-700 dark:text-cyan-400"
          >
            {{ $t('plan.viewDetail') }}
            <AppIcon name="arrow-right" class="size-3.5" />
          </div>
        </div>
      </RouterLink>
    </div>

      <!-- 空状态 -->
      <div v-else class="glass rounded-3xl py-20 text-center">
        <span class="text-4xl">🗂️</span>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ $t('plan.empty') }}</p>
      </div>
    </template>
  </div>
</template>
