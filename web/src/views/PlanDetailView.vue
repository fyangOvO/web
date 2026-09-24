<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import { CATEGORY_EMOJI, type Plan, type PlanCategory, type PlanSection } from '../data/plans';
import { usePlans } from '../composables/usePlans';
import { useI18n, type TranslationKey } from '../composables/useI18n';

const { $t } = useI18n();
const route = useRoute();
const { plans: planList, loaded, load } = usePlans();

onMounted(() => load());

const CAT_KEYS: Record<PlanCategory, TranslationKey> = {
  travel: 'plan.cat.travel',
  tech: 'plan.cat.tech',
  game: 'plan.cat.game',
  health: 'plan.cat.health',
  life: 'plan.cat.life',
};

const all = computed<Plan[]>(() => planList.value ?? []);

const plan = computed<Plan | undefined>(() => all.value.find((p) => p.id === route.params.id));

const index = computed(() => all.value.findIndex((p) => p.id === route.params.id));
const prev = computed<Plan | undefined>(() =>
  index.value > 0 ? all.value[index.value - 1] : undefined
);
const next = computed<Plan | undefined>(() =>
  index.value >= 0 && index.value < all.value.length - 1 ? all.value[index.value + 1] : undefined
);

/** 同分类的其他计划 */
const related = computed<Plan[]>(() =>
  plan.value ? all.value.filter((p) => p.category === plan.value!.category && p.id !== plan.value!.id) : []
);

function catLabel(c: PlanCategory): string {
  return $t(CAT_KEYS[c]);
}

/** 从 "¥1,900" 解析出数值，用于预算条可视化 */
function amountValue(s: string): number {
  const m = s.match(/[\d][\d,]*/);
  return m ? Number(m[0].replace(/,/g, '')) : 0;
}

function budgetMax(section: PlanSection): number {
  return Math.max(1, ...(section.budget ?? []).map((b) => amountValue(b.amount)));
}

function budgetPct(section: PlanSection, amount: string): number {
  return Math.max(4, Math.round((amountValue(amount) / budgetMax(section)) * 100));
}

/** 该 Section 是否真的可渲染 */
function hasBody(s: PlanSection): boolean {
  switch (s.kind) {
    case 'timeline':
      return !!s.nodes?.length;
    case 'cards':
      return !!s.cards?.length;
    case 'budget':
      return !!s.budget?.length;
    case 'list':
      return !!s.list?.length;
    case 'table':
      return !!s.table?.rows.length;
    case 'text':
      return !!s.text;
    default:
      return false;
  }
}

/** 表格是否带表头（第一行即表头时仍按 header 渲染） */
function tableHeaders(s: PlanSection): string[] {
  return s.table?.headers ?? [];
}
</script>

<template>
  <div class="shell pb-16 pt-28 md:pt-36">
    <!-- 加载中 -->
    <div v-if="!loaded" class="glass mx-auto max-w-lg animate-pulse rounded-3xl py-24 text-center">
      <span class="text-4xl">⏳</span>
    </div>

    <!-- 未找到 -->
    <div v-else-if="!plan" class="glass mx-auto max-w-lg rounded-3xl py-20 text-center">
      <span class="text-4xl">🧭</span>
      <h1 class="mt-3 text-xl font-bold">{{ $t('plan.notFound') }}</h1>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ $t('plan.notFoundDesc') }}</p>
      <RouterLink to="/plans" class="btn-primary mt-6 inline-flex items-center gap-2 !px-5 !py-2 text-sm">
        <AppIcon name="chevron-left" class="size-4" />
        {{ $t('plan.back') }}
      </RouterLink>
    </div>

    <template v-else>
      <!-- 返回 -->
      <RouterLink
        to="/plans"
        class="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400"
      >
        <AppIcon name="chevron-left" class="size-4" />
        {{ $t('plan.back') }}
      </RouterLink>

      <!-- 概览 -->
      <section v-reveal class="glass overflow-hidden rounded-3xl">
        <div class="relative bg-gradient-to-br p-8 md:p-10" :class="plan.gradient">
          <div
            class="pointer-events-none absolute -right-6 -top-10 select-none text-[10rem] leading-none opacity-15"
            aria-hidden="true"
          >
            {{ plan.emoji }}
          </div>
          <div class="relative text-white">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1 text-xs font-semibold backdrop-blur-sm"
              >
                <span>{{ CATEGORY_EMOJI[plan.category] }}</span>{{ catLabel(plan.category) }}
              </span>
              <span
                v-for="tag in plan.tags"
                :key="tag"
                class="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm"
              >
                {{ tag }}
              </span>
            </div>
            <h1 class="mt-4 text-2xl font-bold md:text-4xl">{{ plan.title }}</h1>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">{{ plan.subtitle }}</p>
            <p class="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{{ plan.summary }}</p>

            <!-- 关键数字 -->
            <div class="mt-7 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div v-for="m in plan.meta" :key="m.label">
                <p class="text-xs text-white/60">{{ m.label }}</p>
                <p class="mt-0.5 text-lg font-bold">{{ m.value }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 路线 -->
        <div v-if="plan.route?.length" class="p-6 md:p-8">
          <h2 class="mb-4 flex items-center gap-2 text-sm font-bold">
            <AppIcon name="compass" class="size-4 text-cyan-600 dark:text-cyan-400" />
            {{ $t('plan.route') }}
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <template v-for="(city, i) in plan.route" :key="city + i">
              <span
                class="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200"
              >
                {{ city }}
              </span>
              <AppIcon
                v-if="i < plan.route.length - 1"
                name="arrow-right"
                class="size-3.5 shrink-0 text-slate-300 dark:text-slate-600"
              />
            </template>
          </div>
        </div>
      </section>

      <!-- ===== 各 Section ===== -->
      <div class="mt-10 space-y-10">
        <section v-for="(s, si) in plan.sections" v-show="hasBody(s)" :key="si" v-reveal>
          <!-- 区块标题 -->
          <div class="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <AppIcon :name="s.icon" class="size-5 text-cyan-600 dark:text-cyan-400" />
              {{ s.title }}
            </h2>
            <p v-if="s.desc" class="text-xs text-slate-400">{{ s.desc }}</p>
          </div>

          <!-- 时间线 -->
          <ol
            v-if="s.kind === 'timeline'"
            class="relative space-y-6 border-l-2 border-slate-200 pl-8 dark:border-slate-700"
          >
            <li v-for="(n, ni) in s.nodes" :key="ni" class="relative">
              <span
                class="absolute -left-[41px] grid size-8 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-lg"
                :class="plan.gradient"
              >
                {{ n.badge }}
              </span>

              <div class="glass rounded-2xl p-5 md:p-6">
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="n.emoji" class="text-xl">{{ n.emoji }}</span>
                  <h3 class="font-bold">{{ n.title }}</h3>
                  <span v-if="n.meta" class="text-xs text-slate-400">{{ n.meta }}</span>
                  <span
                    v-for="tag in n.tags"
                    :key="tag"
                    class="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-400"
                  >
                    {{ tag }}
                  </span>
                </div>

                <p v-if="n.desc" class="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {{ n.desc }}
                </p>

                <ul v-if="n.items?.length" class="mt-4 space-y-2">
                  <li
                    v-for="(it, i) in n.items"
                    :key="i"
                    class="flex flex-wrap items-baseline gap-2 text-sm"
                  >
                    <span
                      v-if="it.time"
                      class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    >
                      {{ it.time }}
                    </span>
                    <span class="text-slate-700 dark:text-slate-200">{{ it.label }}</span>
                    <span v-if="it.note" class="text-xs text-slate-400">{{ it.note }}</span>
                  </li>
                </ul>

                <div
                  v-if="n.footer?.length"
                  class="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700"
                >
                  <p
                    v-for="(f, i) in n.footer"
                    :key="i"
                    class="flex items-start gap-1.5 text-xs"
                    :class="
                      f.warn
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400'
                    "
                  >
                    <AppIcon :name="f.icon" class="mt-0.5 size-3.5 shrink-0" />
                    <span><b class="font-semibold">{{ f.label }}：</b>{{ f.value }}</span>
                  </p>
                </div>
              </div>
            </li>
          </ol>

          <!-- 卡片 -->
          <div
            v-else-if="s.kind === 'cards'"
            class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <div
              v-for="c in s.cards"
              :key="c.title"
              class="glass relative rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <span
                v-if="c.badge"
                class="absolute right-4 top-4 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
              >
                {{ c.badge }}
              </span>
              <span v-if="c.emoji" class="text-2xl">{{ c.emoji }}</span>
              <h4 class="mt-3 font-semibold">{{ c.title }}</h4>
              <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {{ c.desc }}
              </p>
            </div>
          </div>

          <!-- 预算 -->
          <div v-else-if="s.kind === 'budget'" class="glass rounded-3xl p-6 md:p-8">
            <div class="mb-5 flex items-baseline justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">{{ $t('plan.overview') }}</span>
              <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ¥{{
                  s
                    .budget!.reduce((sum, b) => sum + amountValue(b.amount), 0)
                    .toLocaleString()
                }}
              </span>
            </div>
            <ul class="space-y-3">
              <li v-for="b in s.budget" :key="b.label">
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="text-slate-700 dark:text-slate-200">{{ b.label }}</span>
                  <span class="shrink-0 font-semibold tabular-nums">{{ b.amount }}</span>
                </div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                    :style="{ width: budgetPct(s, b.amount) + '%' }"
                  />
                </div>
                <p v-if="b.note" class="mt-1 text-[11px] text-slate-400">{{ b.note }}</p>
              </li>
            </ul>
          </div>

          <!-- 清单 -->
          <div v-else-if="s.kind === 'list'" class="grid gap-4 sm:grid-cols-2">
            <div v-for="(g, gi) in s.list" :key="gi" class="glass rounded-2xl p-5">
              <h4 v-if="g.title || g.icon" class="flex items-center gap-2 font-semibold">
                <span v-if="g.icon" class="text-lg">{{ g.icon }}</span>
                {{ g.title }}
              </h4>
              <ul class="mt-3 space-y-1.5">
                <li
                  v-for="(item, i) in g.items"
                  :key="i"
                  class="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400"
                >
                  <AppIcon name="check" class="mt-0.5 size-3 shrink-0 text-emerald-500" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- 表格 -->
          <div v-else-if="s.kind === 'table'" class="glass overflow-hidden rounded-2xl">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-700">
                    <th
                      v-for="(h, hi) in tableHeaders(s)"
                      :key="hi"
                      class="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, ri) in s.table!.rows"
                    :key="ri"
                    class="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-white/5"
                  >
                    <td
                      v-for="(cell, ci) in row"
                      :key="ci"
                      class="px-4 py-3 align-top text-slate-700 dark:text-slate-300"
                      :class="ci === 0 ? 'font-medium' : ''"
                    >
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 文本 -->
          <p
            v-else-if="s.kind === 'text'"
            class="glass rounded-2xl p-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {{ s.text }}
          </p>
        </section>

        <!-- 要点提醒 -->
        <section v-if="plan.tips.length" v-reveal>
          <h2 class="mb-5 flex items-center gap-2 text-lg font-bold">
            <AppIcon name="shield" class="size-5 text-violet-600 dark:text-violet-400" />
            {{ $t('plan.tips') }}
          </h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-for="g in plan.tips" :key="g.title" class="glass rounded-2xl p-5">
              <h4 class="flex items-center gap-2 font-semibold">
                <span class="text-lg">{{ g.icon }}</span>
                {{ g.title }}
              </h4>
              <ul class="mt-3 space-y-1.5">
                <li
                  v-for="(item, i) in g.items"
                  :key="i"
                  class="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400"
                >
                  <AppIcon name="check" class="mt-0.5 size-3 shrink-0 text-emerald-500" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 上一个 / 下一个 -->
        <nav class="grid gap-4 sm:grid-cols-2">
          <RouterLink
            v-if="prev"
            :to="`/plans/${prev.id}`"
            class="glass group flex items-center gap-3 rounded-2xl p-4 transition-transform duration-300 hover:-translate-y-1"
          >
            <AppIcon
              name="chevron-left"
              class="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-cyan-500"
            />
            <div class="min-w-0">
              <p class="text-[11px] text-slate-400">{{ $t('plan.prev') }}</p>
              <p class="truncate text-sm font-medium">{{ prev.emoji }} {{ prev.title }}</p>
            </div>
          </RouterLink>
          <span v-else class="hidden sm:block" />

          <RouterLink
            v-if="next"
            :to="`/plans/${next.id}`"
            class="glass group flex items-center justify-end gap-3 rounded-2xl p-4 text-right transition-transform duration-300 hover:-translate-y-1"
          >
            <div class="min-w-0">
              <p class="text-[11px] text-slate-400">{{ $t('plan.next') }}</p>
              <p class="truncate text-sm font-medium">{{ next.title }} {{ next.emoji }}</p>
            </div>
            <AppIcon
              name="chevron-right"
              class="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-cyan-500"
            />
          </RouterLink>
        </nav>

        <!-- 相关计划 -->
        <section v-if="related.length" v-reveal>
          <h2 class="mb-5 text-lg font-bold">{{ $t('plan.related') }}</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RouterLink
              v-for="p in related"
              :key="p.id"
              :to="`/plans/${p.id}`"
              class="glass group flex items-center gap-4 rounded-2xl p-4 transition-transform duration-300 hover:-translate-y-1"
            >
              <span
                class="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xl"
                :class="p.gradient"
              >
                {{ p.emoji }}
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{{ p.title }}</p>
                <p class="truncate text-xs text-slate-400">{{ p.subtitle }}</p>
              </div>
            </RouterLink>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
