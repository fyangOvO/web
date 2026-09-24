<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getMessages, postMessage } from '../api';
import type { Message } from '../types';
import AvatarBadge from '../components/ui/AvatarBadge.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();

const messages = ref<Message[]>([]);
const loading = ref(true);
const error = ref('');

const name = ref('');
const content = ref('');
const website = ref(''); // honeypot
const submitting = ref(false);
const formError = ref('');
const success = ref('');

onMounted(async () => {
  try {
    messages.value = await getMessages();
  } catch {
    error.value = $t('guestbook.loadError');
  } finally {
    loading.value = false;
  }
});

async function submit() {
  formError.value = '';
  success.value = '';
  const n = name.value.trim();
  const c = content.value.trim();
  if (!n) return (formError.value = $t('guestbook.validation.nameRequired'));
  if (n.length > 20) return (formError.value = $t('guestbook.validation.nameLength'));
  if (c.length < 2) return (formError.value = $t('guestbook.validation.contentMin'));
  if (c.length > 500) return (formError.value = $t('guestbook.validation.contentMax'));

  submitting.value = true;
  try {
    const msg = await postMessage({ name: n, content: c, website: website.value });
    if (msg && msg.id && msg.id !== 'spam') {
      messages.value.unshift(msg);
      name.value = '';
      content.value = '';
      website.value = '';
      success.value = $t('guestbook.submitSuccess');
    } else {
      success.value = $t('guestbook.submitSuccess');
    }
  } catch (e: any) {
    formError.value = e?.response?.data?.error ?? $t('guestbook.submitError');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <div class="mb-10 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        Guestbook
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('guestbook.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ $t('guestbook.subtitle') }}
      </p>
    </div>

    <div class="grid gap-8 lg:grid-cols-5">
      <!-- 留言表单 -->
      <div v-reveal class="glass h-fit rounded-3xl p-8 lg:col-span-2 lg:sticky lg:top-24">
        <h2 class="text-lg font-semibold">{{ $t('guestbook.formTitle') }}</h2>

        <form class="mt-6 space-y-5" novalidate @submit.prevent="submit">
          <div>
            <label for="gb-name" class="mb-1.5 block text-sm font-medium">{{ $t('guestbook.nicknameLabel') }}</label>
            <input
              id="gb-name"
              v-model="name"
              type="text"
              maxlength="20"
              :placeholder="$t('guestbook.nicknamePlaceholder')"
              class="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <div>
            <label for="gb-content" class="mb-1.5 block text-sm font-medium">{{ $t('guestbook.contentLabel') }}</label>
            <textarea
              id="gb-content"
              v-model="content"
              rows="5"
              maxlength="500"
              :placeholder="$t('guestbook.contentPlaceholder')"
              class="w-full resize-none rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
            <p class="mt-1 text-right text-xs text-slate-400">{{ content.length }}/500</p>
          </div>

          <!-- honeypot -->
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
          <p v-if="success" class="flex items-center gap-1.5 text-sm text-emerald-500">
            <AppIcon name="check" class="size-4" />
            {{ success }}
          </p>

          <button
            type="submit"
            class="btn-primary w-full justify-center disabled:opacity-60"
            :disabled="submitting"
          >
            <AppIcon name="send" class="size-4" />
            {{ submitting ? $t('guestbook.submitting') : $t('guestbook.submit') }}
          </button>

          <p class="text-xs leading-relaxed text-slate-400">
            {{ $t('guestbook.tip') }}
          </p>
        </form>
      </div>

      <!-- 留言列表 -->
      <div class="lg:col-span-3">
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 4" :key="i" class="skeleton h-28 rounded-2xl" />
        </div>

        <div v-else-if="messages.length" class="space-y-4">
          <div
            v-for="m in messages"
            :key="m.id"
            v-reveal
            class="glass rounded-2xl p-6"
          >
            <div class="flex items-start gap-4">
              <AvatarBadge :text="m.name.slice(0, 1)" size="sm" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <span class="font-semibold">{{ m.name }}</span>
                  <span class="text-xs text-slate-400">{{ m.date }}</span>
                </div>
                <p class="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {{ m.content }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="glass flex flex-col items-center gap-3 rounded-2xl p-14 text-center text-slate-500 dark:text-slate-400"
        >
          <AppIcon name="message" class="size-10 opacity-60" />
          {{ $t('guestbook.firstVisitor') }}
        </div>

        <p v-if="error" class="mt-6 flex items-center justify-center gap-2 text-sm text-red-500">
          <AppIcon name="alert-circle" class="size-4" />
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>
