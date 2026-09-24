<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getProfile, getMapInfo, postContact } from '../api';
import type { Profile, MapInfo } from '../types';
import AppIcon from '../components/ui/AppIcon.vue';
import MapModal from '../components/ui/MapModal.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();

const profile = ref<Profile | null>(null);
const mapOpen = ref(false);
const mapInfo = ref<MapInfo | null>(null);

const form = ref({ name: '', email: '', message: '' });
const website = ref(''); // honeypot
const submitting = ref(false);
const formError = ref('');
const success = ref(false);

onMounted(async () => {
  try {
    profile.value = await getProfile();
  } catch {
    /* 联系方式卡片不阻塞页面 */
  }
  try {
    mapInfo.value = await getMapInfo();
  } catch {
    /* 地图配置缺失时静默 */
  }
});

async function openMap() {
  if (!mapInfo.value) {
    try {
      mapInfo.value = await getMapInfo();
    } catch {
      /* ignore */
    }
  }
  if (mapInfo.value) mapOpen.value = true;
}

async function submit() {
  formError.value = '';
  const n = form.value.name.trim();
  const e = form.value.email.trim();
  const m = form.value.message.trim();
  if (!n) return (formError.value = $t('contact.validation.name'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return (formError.value = $t('contact.validation.email'));
  if (m.length < 5) return (formError.value = $t('contact.validation.messageMin'));

  submitting.value = true;
  try {
    await postContact({ name: n, email: e, message: m, website: website.value });
    success.value = true;
    form.value = { name: '', email: '', message: '' };
    website.value = '';
  } catch (err: any) {
    formError.value = err?.response?.data?.error ?? $t('contact.submitError');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Contact
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('contact.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('contact.subtitle') }}
      </p>
    </div>

    <div class="grid gap-8 lg:grid-cols-5">
      <!-- 联系信息 -->
      <div class="space-y-4 lg:col-span-2">
        <div v-reveal class="glass rounded-3xl p-8">
          <h2 class="text-lg font-semibold">{{ $t('contact.infoTitle') }}</h2>
          <ul class="mt-6 space-y-5 text-sm">
            <li class="flex items-center gap-4">
              <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <AppIcon name="mail" class="size-5" />
              </span>
              <div>
                <div class="text-slate-400">{{ $t('contact.emailLabel') }}</div>
                <a
                  :href="`mailto:${profile?.email ?? ''}`"
                  class="link-underline font-medium"
                >
                  {{ profile?.email ?? 'hello@example.com' }}
                </a>
              </div>
            </li>
            <li class="flex items-center gap-4">
              <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <AppIcon name="map-pin" class="size-5" />
              </span>
              <div>
                <div class="text-slate-400">{{ $t('contact.locationLabel') }}</div>
                <button
                  type="button"
                  class="group flex items-center gap-1.5 font-medium transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
                  @click="openMap"
                >
                  {{ profile?.location ?? 'Jiangsu · Nanjing' }}
                  <AppIcon
                    name="external"
                    class="size-3.5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-500 dark:text-slate-600"
                  />
                </button>
              </div>
            </li>
            <li class="flex items-center gap-4">
              <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <AppIcon name="github" class="size-5" />
              </span>
              <div>
                <div class="text-slate-400">{{ $t('contact.codeLabel') }}</div>
                <a
                  :href="profile?.socials?.[0]?.url ?? '#'"
                  target="_blank"
                  rel="noopener"
                  class="link-underline font-medium"
                >
                  {{ profile?.socials?.[0]?.name ?? 'GitHub' }}
                </a>
              </div>
            </li>
          </ul>
        </div>

        <div v-reveal class="glass rounded-3xl p-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          <p class="font-semibold text-slate-800 dark:text-slate-200">{{ $t('contact.responseSpeed') }}</p>
          <p class="mt-2">
            {{ $tFmt('contact.responseDesc', { hours: '24h' }) }}
            <RouterLink to="/privacy" class="link-underline text-cyan-600 dark:text-cyan-400">
              {{ $t('contact.privacyPolicy') }}
            </RouterLink>。
          </p>
        </div>
      </div>

      <!-- 联系表单 -->
      <div v-reveal class="glass rounded-3xl p-8 lg:col-span-3">
        <h2 class="text-lg font-semibold">{{ $t('contact.formTitle') }}</h2>

        <form class="mt-6 space-y-5" novalidate @submit.prevent="submit">
          <div class="grid gap-5 sm:grid-cols-2">
            <div>
              <label for="c-name" class="mb-1.5 block text-sm font-medium">{{ $t('contact.name') }}</label>
              <input
                id="c-name"
                v-model="form.name"
                type="text"
                maxlength="30"
                :placeholder="$t('contact.formNamePlaceholder')"
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
              />
            </div>
            <div>
              <label for="c-email" class="mb-1.5 block text-sm font-medium">{{ $t('contact.email') }}</label>
              <input
                id="c-email"
                v-model="form.email"
                type="email"
                maxlength="100"
                :placeholder="$t('contact.formEmailPlaceholder')"
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
              />
            </div>
          </div>
          <div>
            <label for="c-message" class="mb-1.5 block text-sm font-medium">{{ $t('contact.message') }}</label>
            <textarea
              id="c-message"
              v-model="form.message"
              rows="6"
              maxlength="1000"
              :placeholder="$t('contact.formMessagePlaceholder')"
              class="w-full resize-none rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>

          <input
            v-model="website"
            type="text"
            tabindex="-1"
            autocomplete="off"
            class="hidden"
            aria-hidden="true"
          />

          <p v-if="formError" class="flex items-center gap-1.5 text-sm text-red-500">
            <AppIcon name="alert-circle" class="size-4" />
            {{ formError }}
          </p>

          <div
            v-if="success"
            class="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <AppIcon name="check" class="size-5 shrink-0" />
            {{ $t('contact.sent') }}
          </div>

          <button
            type="submit"
            class="btn-primary w-full justify-center disabled:opacity-60"
            :disabled="submitting"
          >
            <AppIcon name="send" class="size-4" />
            {{ submitting ? $t('common.loading') : $t('contact.send') }}
          </button>
        </form>
      </div>
    </div>

    <MapModal :open="mapOpen" :info="mapInfo" @close="mapOpen = false" />
  </div>
</template>
