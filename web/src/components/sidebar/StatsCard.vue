<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getStats } from '../../api';
import type { SiteStats } from '../../types';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

const { $t } = useI18n();
const stats = ref<SiteStats | null>(null);

function fmtWords(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function runTime(startDate: string) {
  const s = new Date(`${startDate.slice(0, 10)}T00:00:00`).getTime();
  const days = Math.max(0, Math.floor((Date.now() - s) / 86400000));
  const y = Math.floor(days / 365);
  const d = days % 365;
  return y > 0 ? `${y}${$t('stats.year')} ${d}${$t('stats.day')}` : `${days}${$t('stats.day')}`;
}

/* ---------------- 时间进度（参考图紫条：今日/本周/本月/本年） ---------------- */

interface TimeProgress {
  label: string;
  pct: number;
}

const timeProgress = computed<TimeProgress[]>(() => {
  const n = new Date();
  const y = n.getFullYear();
  const d = n.getDate();
  const minutes = n.getHours() * 60 + n.getMinutes();
  const dayPct = minutes / 1440; // 今日：已过时刻 / 24h
  const weekdayIdx = (n.getDay() + 6) % 7; // 周一 = 0
  const dim = new Date(y, n.getMonth() + 1, 0).getDate();
  const doy = Math.floor((Date.UTC(y, n.getMonth(), d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const pct = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10000) / 100));
  return [
    { label: $t('stats.today'), pct: pct(dayPct) },
    { label: $t('stats.thisWeek'), pct: pct((weekdayIdx + 1) / 7) },
    { label: $t('stats.thisMonth'), pct: pct(d / dim) },
    { label: $t('stats.thisYear'), pct: pct(doy / daysInYear) },
  ];
});

onMounted(async () => {
  try {
    stats.value = await getStats();
  } catch {
    /* 后端未启动时静默 */
  }
});
</script>

<template>
  <section class="glass rounded-3xl p-6">
    <h3 class="flex items-center gap-2 text-sm font-bold">
      <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
        <AppIcon name="server" class="size-3.5" />
      </span>
      {{ $t('stats.title') }}
    </h3>

    <!-- 时间进度紫条 -->
    <div class="mt-4 space-y-2.5">
      <div v-for="p in timeProgress" :key="p.label" class="flex items-center gap-3">
        <span class="w-8 shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ p.label }}</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-500/10">
          <div
            class="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
            :style="{ width: `${p.pct}%` }"
          />
        </div>
        <span class="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400">
          {{ p.pct.toFixed(2) }}%
        </span>
      </div>
    </div>

    <dl v-if="stats" class="mt-4 divide-y divide-slate-200/60 border-t border-slate-200/60 dark:divide-slate-800 dark:border-slate-800">
      <div class="flex items-center justify-between py-2.5">
        <dt class="text-sm text-slate-500 dark:text-slate-400">{{ $t('stats.posts') }}</dt>
        <dd class="font-semibold tabular-nums">{{ stats.postCount }}</dd>
      </div>
      <div class="flex items-center justify-between py-2.5">
        <dt class="text-sm text-slate-500 dark:text-slate-400">{{ $t('stats.words') }}</dt>
        <dd class="font-semibold tabular-nums">{{ fmtWords(stats.wordCount) }}</dd>
      </div>
      <div class="flex items-center justify-between py-2.5">
        <dt class="text-sm text-slate-500 dark:text-slate-400">{{ $t('stats.uptime') }}</dt>
        <dd class="font-semibold tabular-nums">{{ runTime(stats.startDate) }}</dd>
      </div>
      <div class="flex items-center justify-between py-2.5">
        <dt class="text-sm text-slate-500 dark:text-slate-400">{{ $t('stats.lastUpdate') }}</dt>
        <dd class="font-semibold tabular-nums">{{ stats.lastUpdate ? stats.lastUpdate.replace(/-/g, '/') : '—' }}</dd>
      </div>
    </dl>
    <p v-else class="mt-4 py-2 text-xs text-slate-400">{{ $t('stats.empty') }}</p>
  </section>
</template>
