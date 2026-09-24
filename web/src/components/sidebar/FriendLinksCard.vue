<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { getFriendLinks, applyFriendLink } from '../../api';
import type { FriendLink } from '../../types';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

const links = ref<FriendLink[]>([]);
const failedIcons = ref<Set<string>>(new Set());
const formOpen = ref(false);
const busy = ref(false);
const err = ref('');
const done = ref(false);
const { $t } = useI18n();
const form = ref({ name: '', url: '', desc: '', website: '' });

onMounted(async () => {
  try {
    links.value = await getFriendLinks();
  } catch {
    /* 后端未启动时静默 */
  }
});

/** 站点图标：优先 DuckDuckGo 图标服务，加载失败回退到首字母 */
function faviconOf(url: string) {
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`;
  } catch {
    return '';
  }
}

function onFavError(url: string) {
  failedIcons.value = new Set(failedIcons.value).add(url);
}

async function submit() {
  err.value = '';
  if (!form.value.name.trim() || !form.value.url.trim()) {
    err.value = $t('friendlinks.nameUrlRequired');
    return;
  }
  busy.value = true;
  try {
    await applyFriendLink({
      name: form.value.name.trim(),
      url: form.value.url.trim(),
      desc: form.value.desc.trim(),
      website: form.value.website,
    });
    done.value = true;
    window.setTimeout(() => {
      done.value = false;
      formOpen.value = false;
      form.value = { name: '', url: '', desc: '', website: '' };
    }, 2600);
  } catch (e: any) {
    err.value = e?.response?.data?.error ?? $t('friendlinks.submitError');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="glass rounded-3xl p-6">
    <h3 class="flex items-center gap-2 text-sm font-bold">
      <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
        <AppIcon name="external" class="size-3.5" />
      </span>
      {{ $t('friendlinks.title') }}
    </h3>

    <div class="mt-4 space-y-1.5">
      <component
        :is="l.name === '更多' ? RouterLink : 'a'"
        v-for="l in links"
        :key="l.name"
        :to="l.name === '更多' ? '/nav' : undefined"
        :href="l.name === '更多' ? undefined : l.url"
        :target="l.name === '更多' ? undefined : '_blank'"
        :rel="l.name === '更多' ? undefined : 'noopener noreferrer'"
        class="group flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-cyan-500/5"
      >
        <span class="flex min-w-0 items-center gap-3">
          <span
            class="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 text-sm font-bold text-cyan-600 dark:text-cyan-400"
          >
            {{ l.name.slice(0, 1) }}
            <img
              v-if="l.name !== '更多' && faviconOf(l.url)"
              v-show="!failedIcons.has(l.url)"
              :src="faviconOf(l.url)"
              alt=""
              loading="lazy"
              class="absolute inset-0 size-full rounded-xl bg-white object-cover dark:bg-slate-800"
              @error="onFavError(l.url)"
            />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
              {{ l.name }}
            </span>
            <span v-if="l.desc && l.name !== '更多'" class="block truncate text-xs text-slate-400">
              {{ l.desc }}
            </span>
          </span>
        </span>
        <AppIcon
          name="arrow-right"
          class="size-3.5 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-500 dark:text-slate-600"
        />
      </component>
      <p v-if="!links.length" class="px-3 py-2 text-xs text-slate-400">{{ $t('friendlinks.empty') }}</p>
    </div>

    <button
      v-if="!formOpen"
      type="button"
      class="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-400"
      @click="formOpen = true"
    >
      <AppIcon name="plus" class="size-3.5" />
      {{ $t('friendlinks.apply') }}
    </button>

    <form v-else class="mt-4 space-y-2.5" @submit.prevent="submit">
      <input
        v-model="form.name"
        type="text"
        maxlength="30"
        :placeholder="$t('friendlinks.namePlaceholder')"
        class="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      <input
        v-model="form.url"
        type="url"
        maxlength="200"
        :placeholder="$t('friendlinks.urlPlaceholder')"
        class="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      <input
        v-model="form.desc"
        type="text"
        maxlength="120"
        :placeholder="$t('friendlinks.descPlaceholder')"
        class="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      />
      <!-- honeypot：人类不会填写的隐藏字段 -->
      <input
        v-model="form.website"
        type="text"
        tabindex="-1"
        autocomplete="off"
        class="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      <p v-if="err" class="text-xs text-red-500">{{ err }}</p>
      <p v-if="done" class="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <AppIcon name="check" class="size-3.5" />
        {{ $t('friendlinks.submitted') }}
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          :disabled="busy"
          @click="formOpen = false"
        >
          <AppIcon name="close" class="size-3.5" />
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:scale-[1.02] disabled:opacity-60"
          :disabled="busy"
        >
          <AppIcon :name="busy ? 'refresh-cw' : 'send'" class="size-3.5" />
          {{ busy ? $t('common.submitting') : $t('friendlinks.submit') }}
        </button>
      </div>
    </form>
  </section>
</template>
