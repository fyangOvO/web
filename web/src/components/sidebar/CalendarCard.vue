<script setup lang="ts">
import { computed, ref } from 'vue';
// lunar-javascript 为 CJS 模块，必须走默认导入再解构，避免命名导入互操作失败
import LunarJS from 'lunar-javascript';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

const { $t, $tFmt } = useI18n();
const Solar = LunarJS.Solar;

const HOLIDAY_TARGET = '2026-09-25'; // 倒计时目标：中秋节

const now = new Date();
const viewY = ref(now.getFullYear());
const viewM = ref(now.getMonth()); // 0-based
const WEEKDAYS = computed(() => [
  $t('calendar.weekMon'), $t('calendar.weekTue'), $t('calendar.weekWed'),
  $t('calendar.weekThu'), $t('calendar.weekFri'), $t('calendar.weekSat'), $t('calendar.weekSun'),
]);

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function iso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());

interface Cell {
  d: number;
  iso: string;
  sub: string;
  holiday: boolean;
  blank: boolean;
}

/** 格子下方小字：节日（优先）> 农历日期（初一显示月份）；异常时安全回退 */
function cellInfo(y: number, m: number, d: number): { sub: string; holiday: boolean } {
  try {
    const s = Solar.fromYmd(y, m + 1, d);
    const l = s.getLunar();
    const fest = l.getFestivals()[0] || s.getFestivals()[0];
    if (fest) return { sub: fest.slice(0, 2), holiday: true };
    if (l.getDay() === 1) return { sub: `${l.isLeap() ? '闰' : ''}${l.getMonthInChinese()}月`, holiday: false };
    return { sub: l.getDayInChinese(), holiday: false };
  } catch {
    return { sub: '', holiday: false };
  }
}

const grid = computed<Cell[]>(() => {
  const y = viewY.value;
  const m = viewM.value;
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // 周一为一周起始
  const dim = new Date(y, m + 1, 0).getDate();
  const arr: Cell[] = [];
  for (let i = 0; i < first; i++) arr.push({ d: 0, iso: '', sub: '', holiday: false, blank: true });
  for (let d = 1; d <= dim; d++) {
    const info = cellInfo(y, m, d);
    arr.push({ d, iso: iso(y, m, d), sub: info.sub, holiday: info.holiday, blank: false });
  }
  return arr;
});

const monthLabel = computed(() => $tFmt('calendar.monthLabel', { y: viewY.value, m: viewM.value + 1 }));

function shiftMonth(delta: number) {
  let m = viewM.value + delta;
  let y = viewY.value;
  if (m < 0) {
    m = 11;
    y--;
  }
  if (m > 11) {
    m = 0;
    y++;
  }
  viewM.value = m;
  viewY.value = y;
}

const countdown = computed(() => {
  const t = new Date(`${HOLIDAY_TARGET}T00:00:00`).getTime();
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - n) / 86400000);
});
</script>

<template>
  <section class="glass rounded-3xl p-6">
    <div class="flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-bold">
        <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
          <AppIcon name="calendar" class="size-3.5" />
        </span>
        {{ $t('calendar.title') }}
      </h3>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="grid size-7 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
          :aria-label="$t('calendar.prevMonth')"
          @click="shiftMonth(-1)"
        >
          <AppIcon name="arrow-right" class="size-3.5 rotate-180" />
        </button>
        <span class="min-w-16 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{{ monthLabel }}</span>
        <button
          type="button"
          class="grid size-7 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
          :aria-label="$t('calendar.nextMonth')"
          @click="shiftMonth(1)"
        >
          <AppIcon name="arrow-right" class="size-3.5" />
        </button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-7 gap-1 text-center">
      <span v-for="w in WEEKDAYS" :key="w" class="py-1 text-[11px] font-medium text-slate-400">
        {{ w }}
      </span>
      <template v-for="c in grid" :key="c.iso || `b${grid.indexOf(c)}`">
        <span v-if="c.blank" class="aspect-square text-[11px] leading-none" />
        <span
          v-else
          class="relative grid aspect-square place-items-center rounded-lg text-[13px] transition-colors"
          :class="[
            c.iso === todayISO
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 font-bold text-white shadow-md shadow-cyan-500/30'
              : c.holiday
                ? 'bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          ]"
        >
          {{ c.d }}
          <span
            v-if="c.iso !== todayISO"
            class="absolute bottom-0.5 left-1/2 max-w-full -translate-x-1/2 truncate text-[9px] font-medium leading-none"
            :class="c.holiday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'"
          >
            {{ c.sub }}
          </span>
        </span>
      </template>
    </div>

    <div class="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3">
      <span class="text-xs text-slate-500 dark:text-slate-400">{{ $t('calendar.until') }}</span>
      <span class="text-sm font-bold text-amber-600 dark:text-amber-400">
        <template v-if="countdown > 0">{{ countdown }} {{ $t('calendar.days') }}</template>
        <template v-else-if="countdown === 0">{{ $t('calendar.today') }}</template>
        <template v-else>{{ $t('calendar.passed') }}</template>
      </span>
    </div>
  </section>
</template>
