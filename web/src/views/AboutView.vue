<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getProfile, getTimeline } from '../api';
import type { Profile, TimelineItem } from '../types';
import AvatarBadge from '../components/ui/AvatarBadge.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t } = useI18n();

const profile = ref<Profile | null>(null);
const timeline = ref<TimelineItem[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const [p, t] = await Promise.all([getProfile(), getTimeline()]);
    profile.value = p;
    timeline.value = t;
  } catch {
    error.value = $t('error.network');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell pb-10 pt-28 md:pt-36">
    <!-- 页头 -->
    <div class="mb-14 text-center">
      <span class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
        About
      </span>
      <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{{ $t('about.title') }}</h1>
      <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-400">
        {{ profile?.title || '' }}
      </p>
    </div>

    <div v-if="loading" class="space-y-6">
      <div class="skeleton h-64 rounded-3xl" />
      <div class="skeleton h-40 rounded-3xl" />
    </div>

    <div v-else-if="profile" class="grid gap-6 lg:grid-cols-3">
      <!-- 个人卡片 -->
      <div v-reveal class="glass h-fit rounded-3xl p-8 lg:sticky lg:top-24">
        <div class="flex flex-col items-center text-center">
          <AvatarBadge :text="profile.avatarText" :image="profile.avatar" size="lg" />
          <h2 class="mt-4 text-2xl font-bold">{{ profile.name }}</h2>
          <p class="mt-1 text-sm text-cyan-600 dark:text-cyan-400">{{ profile.title }}</p>
          <p class="mt-3 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <AppIcon name="map-pin" class="size-4" />
            {{ profile.location }}
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <a
              v-for="s in profile.socials"
              :key="s.name"
              :href="s.url"
              target="_blank"
              rel="noopener"
              class="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:text-slate-400"
              :aria-label="s.name"
            >
              <AppIcon :name="s.name === '邮件' || s.name === 'Email' ? 'mail' : 'github'" class="size-4" />
            </a>
          </div>
        </div>
      </div>

      <!-- 右侧内容 -->
      <div class="space-y-6 lg:col-span-2">
        <!-- 简介 -->
        <div v-reveal class="glass rounded-3xl p-8">
          <h3 class="text-lg font-semibold">{{ $t('about.skills') }}</h3>
          <div class="mt-4 space-y-4 leading-relaxed text-slate-600 dark:text-slate-400">
            <p v-for="(para, i) in profile.bio" :key="i">{{ para }}</p>
          </div>
        </div>

        <!-- 个人信息 Bento -->
        <div v-reveal class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="(info, i) in profile.info"
            :key="info.label"
            class="glass rounded-2xl p-5"
            :class="i === 0 ? 'sm:col-span-2' : ''"
          >
            <div class="text-xs font-medium uppercase tracking-wider text-slate-400">
              {{ info.label }}
            </div>
            <div class="mt-1.5 font-semibold">{{ info.value }}</div>
          </div>
        </div>

        <!-- 兴趣爱好 -->
        <div v-reveal class="glass rounded-3xl p-8">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <AppIcon name="heart" class="size-5 text-cyan-500" />
            {{ $t('about.skills') }}
          </h3>
          <div class="mt-4 flex flex-wrap gap-2.5">
            <span
              v-for="h in profile.hobbies"
              :key="h"
              class="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-600 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:text-cyan-400"
            >
              {{ h }}
            </span>
          </div>
        </div>

        <!-- 时间线 -->
        <div v-reveal class="glass rounded-3xl p-8">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <AppIcon name="briefcase" class="size-5 text-cyan-500" />
            {{ $t('about.timeline') }}
          </h3>
          <ol class="relative mt-6 space-y-8 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
            <li v-for="item in timeline" :key="item.period" class="relative">
              <span
                class="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-white bg-cyan-500 shadow dark:border-slate-900"
              />
              <div class="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                {{ item.period }}
              </div>
              <h4 class="mt-1 font-semibold">
                {{ item.role }}
                <span class="font-normal text-slate-500 dark:text-slate-400">
                  · {{ item.org }}
                </span>
              </h4>
              <p class="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {{ item.desc }}
              </p>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <p v-else-if="error" class="mt-10 text-center text-sm text-red-500">{{ error }}</p>
  </div>
</template>
