<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getProfile, getSkills, getProjects, getPosts } from "../api";
import type { Profile, Skill, Project, Post } from "../types";
import AuroraBackground from "../components/ui/AuroraBackground.vue";
import GradientText from "../components/ui/GradientText.vue";
import TypewriterText from "../components/ui/TypewriterText.vue";
import SectionHeading from "../components/ui/SectionHeading.vue";
import AppIcon from "../components/ui/AppIcon.vue";
import ProjectCard from "../components/ProjectCard.vue";
import PostCard from "../components/PostCard.vue";
import SkillBento from "../components/SkillBento.vue";
import HeroCarousel from "../components/home/HeroCarousel.vue";
import FluxButton from "../components/ui/FluxButton.vue";
import { useSettings } from "../composables/useSettings";
import { useI18n } from "../composables/useI18n";
import { useRouter } from "vue-router";

const { $t } = useI18n();

const router = useRouter();
const { fancyButtons } = useSettings();

/** 延遲導航，給按鈕爆炸粒子留出顯示時間 */
function go(path: string) {
  setTimeout(() => router.push(path), 260);
}

const profile = ref<Profile | null>(null);
const skills = ref<Skill[]>([]);
const projects = ref<Project[]>([]);
const posts = ref<Post[]>([]);
const loading = ref(true);
const error = ref("");

// 轮播显示开关：以后端站点设置为准，前台切换同步到后端
const { showCarousel, updateSettings } = useSettings();
const carouselVisible = showCarousel;
async function toggleCarousel() {
  const next = !carouselVisible.value;
  try {
    await updateSettings({ showCarousel: next });
  } catch {
    /* 同步失败时仅本地切换 */
  }
}

onMounted(async () => {
  try {
    const [p, s, pr, po] = await Promise.all([
      getProfile(),
      getSkills(),
      getProjects(true),
      getPosts(3, "blog"),
    ]);
    profile.value = p;
    skills.value = s;
    projects.value = pr;
    posts.value = po;
  } catch {
    error.value = $t('error.network');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <!-- ============ 首屏：滿屏輪播 ============ -->
    <section v-if="carouselVisible" class="relative">
      <HeroCarousel />

      <!-- 輪播開關（右下角） -->
      <button
        type="button"
        :aria-label="$t('home.closeCarousel')"
        :title="$t('home.closeCarousel')"
        class="fixed bottom-4 right-4 z-40 hidden size-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/35 md:grid"
        @click="toggleCarousel"
      >
        <AppIcon name="eye-off" class="size-4" />
      </button>
    </section>

    <!-- ============ 輪播關閉時：獨立 Hero 區 ============ -->
    <section v-else class="relative overflow-hidden pb-20 pt-24 md:pb-28 md:pt-28">
      <AuroraBackground />

      <div class="shell relative">
        <div class="flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:text-cyan-600 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-cyan-400"
            @click="toggleCarousel"
          >
            <AppIcon name="eye" class="size-3.5" />
            {{ $t('home.showCarousel') }}
          </button>
        </div>

        <div class="max-w-3xl">
          <div
            v-reveal
            class="glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <span class="size-2 animate-pulse rounded-full bg-cyan-400" />
            {{ profile?.title ?? "前端开发工程师" }} ·
            {{ profile?.location ?? "江苏 · 南京" }}
          </div>

          <h1
            v-reveal
            class="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl"
          >
            <span class="text-slate-900 dark:text-white">{{ $t('home.heroGreeting') }}</span><br />
            <GradientText shimmer class="text-5xl md:text-7xl">
              {{ profile?.name ?? "柳絮" }}
            </GradientText>
          </h1>

          <p
            v-reveal
            class="mt-5 min-h-8 text-lg font-medium text-slate-600 dark:text-slate-300 md:text-xl"
          >
            <TypewriterText
              :phrases="profile?.tagline ?? ['用代码构建更美好的互联网']"
            />
          </p>

          <p
            v-reveal
            class="mt-6 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {{ profile?.bio[0] }}
          </p>

          <div v-reveal class="mt-9 flex flex-wrap gap-4">
            <FluxButton v-if="fancyButtons" variant="primary" @click="go('/projects')">
              {{ $t('home.viewProjects') }}
              <AppIcon name="arrow-right" class="size-4" />
            </FluxButton>
            <RouterLink v-else to="/projects" class="btn-primary">
              {{ $t('home.viewProjects') }}
              <AppIcon name="arrow-right" class="size-4" />
            </RouterLink>
            <FluxButton v-if="fancyButtons" variant="ghost" @click="go('/contact')">
              {{ $t('home.contactMe') }}
            </FluxButton>
            <RouterLink v-else to="/contact" class="btn-ghost">{{ $t('home.contactMe') }}</RouterLink>
          </div>
        </div>

        <!-- 数据统计 -->
        <div v-reveal class="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div
            v-for="s in profile?.stats ?? []"
            :key="s.label"
            class="glass rounded-2xl p-5 text-center transition-transform duration-300 hover:-translate-y-1"
          >
            <div class="text-gradient text-2xl font-bold md:text-3xl">
              {{ s.value }}
            </div>
            <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ s.label }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ Hero 個人介紹（輪播模式時顯示在輪播下方） ============ -->
    <section v-if="carouselVisible" class="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20">
      <AuroraBackground />
      <div class="shell relative">
        <div class="max-w-3xl">
          <div
            v-reveal
            class="glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <span class="size-2 animate-pulse rounded-full bg-cyan-400" />
            {{ profile?.title ?? "前端开发工程师" }} ·
            {{ profile?.location ?? "江苏 · 南京" }}
          </div>

          <h1
            v-reveal
            class="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl"
          >
            <span class="text-slate-900 dark:text-white">{{ $t('home.heroGreeting') }}</span>
            <GradientText shimmer class="text-5xl md:text-6xl">
              {{ profile?.name ?? "柳絮" }}
            </GradientText>
          </h1>

          <p
            v-reveal
            class="mt-4 min-h-8 text-lg font-medium text-slate-600 dark:text-slate-300 md:text-xl"
          >
            <TypewriterText
              :phrases="profile?.tagline ?? ['用代码构建更美好的互联网']"
            />
          </p>

          <p
            v-reveal
            class="mt-4 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {{ profile?.bio[0] }}
          </p>

          <div v-reveal class="mt-8 flex flex-wrap gap-4">
            <FluxButton v-if="fancyButtons" variant="primary" @click="go('/projects')">
              {{ $t('home.viewProjects') }}
              <AppIcon name="arrow-right" class="size-4" />
            </FluxButton>
            <RouterLink v-else to="/projects" class="btn-primary">
              {{ $t('home.viewProjects') }}
              <AppIcon name="arrow-right" class="size-4" />
            </RouterLink>
            <FluxButton v-if="fancyButtons" variant="ghost" @click="go('/contact')">
              {{ $t('home.contactMe') }}
            </FluxButton>
            <RouterLink v-else to="/contact" class="btn-ghost">{{ $t('home.contactMe') }}</RouterLink>
          </div>
        </div>

        <!-- 数据统计 -->
        <div v-reveal class="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div
            v-for="s in profile?.stats ?? []"
            :key="s.label"
            class="glass rounded-2xl p-5 text-center transition-transform duration-300 hover:-translate-y-1"
          >
            <div class="text-gradient text-2xl font-bold md:text-3xl">
              {{ s.value }}
            </div>
            <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ s.label }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 技能栈 ============ -->
    <section class="shell py-16 md:py-24">
      <SectionHeading
        kicker="Skills"
        :title="$t('home.skillsTitle')"
        :desc="$t('home.skillsDesc')"
      />
      <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="skeleton h-52 rounded-2xl" />
      </div>
      <SkillBento v-else-if="skills.length" :skills="skills" />
    </section>

    <!-- ============ 精选项目 ============ -->
    <section class="shell py-16 md:py-24">
      <SectionHeading
        kicker="Projects"
        :title="$t('home.featuredProjects')"
        :desc="$t('home.projectsDesc')"
      />
      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="i in 3"
          :key="i"
          v-if="loading"
          class="skeleton h-72 rounded-2xl"
        />
        <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
      </div>
      <div v-reveal class="mt-12 text-center">
        <RouterLink to="/projects" class="btn-ghost">
          {{ $t('home.viewAll') }}
          <AppIcon name="arrow-right" class="size-4" />
        </RouterLink>
      </div>
    </section>

    <!-- ============ 最新博客 ============ -->
    <section class="shell py-16 md:py-24">
      <SectionHeading
        kicker="Blog"
        :title="$t('home.latestPosts')"
        :desc="$t('home.blogDesc')"
      />
      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="i in 3"
          :key="i"
          v-if="loading"
          class="skeleton h-56 rounded-2xl"
        />
        <PostCard v-for="post in posts" :key="post.id" :post="post" />
      </div>
      <div v-reveal class="mt-12 text-center">
        <RouterLink to="/blog" class="btn-ghost">
          {{ $t('home.readAllPosts') }}
          <AppIcon name="arrow-right" class="size-4" />
        </RouterLink>
      </div>
    </section>

    <!-- ============ 留言 CTA ============ -->
    <section class="shell py-16 md:py-24">
      <div
        v-reveal
        class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-700 px-8 py-14 text-center text-white shadow-2xl shadow-cyan-500/25 md:px-16"
      >
        <div class="dot-grid absolute inset-0 opacity-30" />
        <div class="relative">
          <h2 class="text-2xl font-bold md:text-3xl">{{ $t('home.guestbookCtaTitle') }}</h2>
          <p
            class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-cyan-50/90 md:text-base"
          >
            {{ $t('home.guestbookCtaDesc') }}
          </p>
          <RouterLink
            to="/guestbook"
            class="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-cyan-700 shadow-lg transition-transform hover:scale-105"
          >
            <AppIcon name="message" class="size-4" />
            {{ $t('home.toGuestbook') }}
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-300/50 bg-red-50 px-5 py-4 text-sm text-red-600 shadow-xl dark:border-red-500/30 dark:bg-red-950/80 dark:text-red-300"
    >
      <AppIcon name="alert-circle" class="size-5 shrink-0" />
      {{ error }}
      <button
        type="button"
        class="ml-auto shrink-0 rounded-lg p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900"
        :aria-label="$t('common.close')"
        @click="error = ''"
      >
        <AppIcon name="close" class="size-4" />
      </button>
    </div>
  </div>
</template>
