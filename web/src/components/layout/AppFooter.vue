<script setup lang="ts">
import AppIcon from "../ui/AppIcon.vue";
import { useI18n } from "../../composables/useI18n";

const { $t } = useI18n();
const year = new Date().getFullYear();

const nav = [
  { to: "/about", label: $t('nav.about') },
  { to: "/projects", label: $t('nav.projects') },
  { to: "/blog", label: $t('nav.blog') },
  { to: "/guestbook", label: $t('nav.guestbook') },
  { to: "/contact", label: $t('contact.title') },
];

const socials = [
  { name: "GitHub", url: "https://github.com/yourname", icon: "github" },
  { name: "Gitee", url: "https://gitee.com/yourname", icon: "code" },
  { name: $t('contact.title'), url: "mailto:hello@example.com", icon: "mail" },
];
</script>

<template>
  <footer class="mt-24 border-t border-slate-200 dark:border-slate-800">
    <div class="shell grid gap-10 py-14 md:grid-cols-3">
      <div>
        <div class="flex items-center gap-2.5">
          <span
            class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white"
          >
            陽
          </span>
          <span class="font-semibold">柳絮.sun</span>
        </div>
        <p
          class="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400"
        >
          用代码构建更美好的互联网，记录技术思考与成长轨迹。本站为演示内容，请在
          server/data/db.json 中替换为你的真实信息。
        </p>
      </div>

      <div>
        <h4 class="text-sm font-semibold">{{ $t('nav.nav') }}</h4>
        <ul
          class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <li v-for="item in nav" :key="item.to">
            <RouterLink :to="item.to" class="link-underline">{{
              item.label
            }}</RouterLink>
          </li>
        </ul>
      </div>

      <div>
        <h4 class="text-sm font-semibold">{{ $t('contact.title') }}</h4>
        <div class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <p class="flex items-center gap-2">
            <AppIcon name="mail" class="size-4 text-cyan-500" />
            sun@example.com
          </p>
          <p class="flex items-center gap-2">
            <AppIcon name="map-pin" class="size-4 text-cyan-500" />
            江苏 · 南京
          </p>
          <div class="flex items-center gap-3 pt-2">
            <a
              v-for="s in socials"
              :key="s.name"
              :href="s.url"
              target="_blank"
              rel="noopener"
              :aria-label="s.name"
              class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:text-slate-400"
            >
              <AppIcon :name="s.icon" class="size-4" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-slate-200 dark:border-slate-800">
      <div
        class="shell flex flex-col items-center justify-between gap-3 py-6 text-xs text-slate-500 dark:text-slate-500 sm:flex-row"
      >
        <p>© {{ year }} 柳絮 · 保留所有权利</p>
        <div class="flex items-center gap-4">
          <RouterLink to="/privacy" class="link-underline">隐私政策</RouterLink>
          <span class="flex items-center gap-1.5">
            <AppIcon name="shield" class="size-3.5" />
            苏ICP备XXXXXXXX号-1（占位）
          </span>
        </div>
        <p>Powered by Vue 3 · Node.js · Tailwind CSS</p>
      </div>
    </div>
  </footer>
</template>
