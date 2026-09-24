<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "../ui/AppIcon.vue";
import ThemeToggle from "../ui/ThemeToggle.vue";
import HaloSearch from "../ui/HaloSearch.vue";
import { getProfile, getSettings, type Profile } from "../../api";
import { useI18n } from "../../composables/useI18n";

const route = useRoute();
const { $t } = useI18n();
const scrolled = ref(false);
const open = ref(false);
const profile = ref<Profile | null>(null);

/** 导航栏条目：后台可配，默认文艺单字 */
interface NavItem { to: string; label: string; icon?: string; hidden?: boolean }
const DEFAULT_NAV: NavItem[] = [
  { to: "/", label: "家" },
  { to: "/about", label: "我" },
  { to: "/projects", label: "作" },
  { to: "/blog", label: "文" },
  { to: "/essay", label: "思" },
  { to: "/notes", label: "影" },
  { to: "/album", label: "忆" },
  { to: "/nav", label: "趣" },
  { to: "/guestbook", label: "言" },
];
const navItems = ref<NavItem[]>(DEFAULT_NAV);

/** Navbar 是否可見（首屏隱藏，向下滾動顯示） */
const visible = ref(false);

onMounted(async () => {
  try {
    profile.value = await getProfile();
  } catch { /* 忽略 */ }
  try {
    const s = await getSettings();
    if (s.navItems && s.navItems.length) navItems.value = s.navItems;
  } catch { /* 忽略 */ }
});

const links = computed(() => navItems.value.filter((n) => !n.hidden));
const mobileLinks = computed(() => [...links.value, { to: "/contact", label: "讯" }]);

/** 是否首頁（首頁有滿屏輪播需要隱藏 Navbar） */
const isHome = computed(() => route.path === "/" || route.path === "");

let lastScrollY = 0;
const SHOW_THRESHOLD = 80;   // 向下滾動超過此值顯示 Navbar
const HIDE_THRESHOLD = 40;   // 回到頂部少於此值隱藏 Navbar

function onScroll() {
  const y = window.scrollY;
  scrolled.value = y > 10;

  if (!isHome.value) {
    // 非首頁：Navbar 常駐
    visible.value = true;
  } else {
    // 首頁：根據滾動位置 + 方向決定
    if (y <= HIDE_THRESHOLD) {
      // 在頂部 → 隱藏
      visible.value = false;
    } else if (y > SHOW_THRESHOLD || y < lastScrollY - 3) {
      // 向下滾動超過閾值，或向上滾動 → 顯示
      visible.value = true;
    }
  }
  lastScrollY = y;
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});
onUnmounted(() => window.removeEventListener("scroll", onScroll));

/** 路由切換時立即更新 Navbar 可見性 */
watch(
  () => route.path,
  () => {
    if (!isHome.value) {
      visible.value = true;
    } else {
      visible.value = window.scrollY > SHOW_THRESHOLD;
    }
  }
);

function isActive(to: string) {
  return to === "/" ? route.path === "/" : route.path.startsWith(to);
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-all duration-500"
    :class="[
      visible || open
        ? 'translate-y-0 opacity-100'
        : '-translate-y-full opacity-0 pointer-events-none',
      scrolled || open ? 'glass shadow-lg shadow-slate-900/5' : 'bg-transparent',
    ]"
  >
    <nav class="shell flex h-16 items-center gap-4">
      <!-- 左侧 Logo -->
      <RouterLink to="/" class="group logo-origami-wrap flex shrink-0 items-center gap-2.5">
        <span
          class="logo-origami-grid grid size-9 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-lg transition-transform duration-500 ease-out group-hover:scale-110 group-hover:[transform-style:preserve-3d]"
          :style="{
            background: profile?.avatar ? 'transparent' : 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
            boxShadow: profile?.avatar ? '0 4px 16px -4px rgba(0,0,0,0.25)' : '0 8px 24px -6px rgba(var(--accent-1-rgb), 0.45)',
          }"
        >
          <img
            v-if="profile?.avatar"
            :src="profile.avatar"
            :alt="profile?.name || '头像'"
            class="logo-origami-img size-full rounded-xl object-cover"
          />
          <span v-else class="logo-origami-text">{{ profile?.avatarText || '序' }}</span>
        </span>
        <span class="text-base font-semibold tracking-wide transition-all duration-500 group-hover:tracking-wider">
          {{ profile?.name || '柳絮' }}<span :style="{ color: 'var(--accent-1)' }">.sun</span>
        </span>
      </RouterLink>

      <!-- 中间 导航（左右分离） -->
      <div class="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium tracking-wide transition-all hover:scale-110"
          :class="
            isActive(l.to)
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          "
          :style="isActive(l.to) ? { color: 'var(--accent-1)', transform: 'scale(1.1)' } : {}"
        >
          <img
            v-if="l.icon"
            :src="l.icon"
            :alt="l.label"
            class="size-4 rounded object-contain"
          />
          <span>{{ l.label }}</span>
        </RouterLink>
      </div>

      <!-- 右侧 搜索 + 主题 + 联系 -->
      <div class="hidden items-center gap-2 lg:flex">
        <HaloSearch />
        <ThemeToggle />
        <RouterLink
          to="/contact"
          class="rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-transform hover:scale-105"
          :style="{
            background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))',
            boxShadow: '0 6px 20px -8px rgba(var(--accent-1-rgb), 0.5)',
          }"
        >
          {{ $t('contact.title') }}
        </RouterLink>
      </div>

      <!-- 移动端：联系 + 主题 + 菜单 -->
      <div class="flex flex-1 items-center justify-end gap-2 lg:hidden">
        <ThemeToggle />
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition-colors hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
          :aria-label="open ? $t('common.close') : $t('common.more')"
          @click="open = !open"
        >
          <AppIcon :name="open ? 'close' : 'menu'" class="size-5" />
        </button>
      </div>
    </nav>

    <!-- 移动端菜单 -->
    <Transition name="fade">
      <div
        v-if="open"
        class="glass border-t border-slate-200/60 px-4 pb-4 pt-2 dark:border-slate-800"
      >
        <RouterLink
          v-for="l in mobileLinks"
          :key="l.to"
          :to="l.to"
          class="block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          :class="
            isActive(l.to)
              ? 'dark:text-slate-200'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          "
          :style="
            isActive(l.to)
              ? { color: 'var(--accent-1)', backgroundColor: 'rgba(var(--accent-1-rgb), 0.1)' }
              : {}
          "
          @click="open = false"
        >
          {{ l.label }}
        </RouterLink>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* === Logo Origami 折纸效果 === */
.logo-origami-wrap {
  perspective: 600px;
}

.logo-origami-grid {
  transform-style: preserve-3d;
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.4s ease;
  will-change: transform;
}

.logo-origami-wrap:hover .logo-origami-grid {
  /* 折纸翻折：先 Y 轴旋转翻折一下，再轻微 X 轴倾斜，配合 scale 放大 */
  transform: perspective(600px) rotateY(-12deg) rotateX(8deg) scale(1.18);
  box-shadow:
    0 12px 32px -8px rgba(var(--accent-1-rgb), 0.55),
    0 0 0 1px rgba(var(--accent-1-rgb), 0.35);
}

/* 翻折时内部分层的细微阴影变化，模拟折纸纸张叠层 */
.logo-origami-wrap:hover .logo-origami-grid::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.18) 0%, transparent 40%);
  pointer-events: none;
}

.logo-origami-wrap:hover .logo-origami-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(-135deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
  pointer-events: none;
}

.logo-origami-img,
.logo-origami-text {
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.4s ease;
}

.logo-origami-wrap:hover .logo-origami-img {
  /* 图片在翻折时也做轻微的反向旋转，产生立体感 */
  transform: translateZ(8px);
  filter: saturate(1.15);
}

.logo-origami-wrap:hover .logo-origami-text {
  transform: translateZ(10px);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
</style>
