<script setup lang="ts">
/**
 * AlbumDetailView — 相冊分類詳情頁。
 * 顯示該分類下所有圖片（網格佈局），點擊圖片可放大預覽（lightbox）。
 * 如果分類有獨立密碼保護且未驗證，會彈窗提示輸入密碼。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAlbumCategory, getAlbumPhotos, verifyCategoryPassword, type AlbumCategory, type AlbumPhoto } from '../api/album';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';
import { useSettings } from '../composables/useSettings';

const route = useRoute();
const router = useRouter();
const { $t, $tFmt } = useI18n();
const catId = computed(() => String(route.params.id || ''));

const category = ref<AlbumCategory | null>(null);
const photos = ref<AlbumPhoto[]>([]);
const loading = ref(true);
const errMsg = ref('');

// 分類密碼驗證彈窗
const categoryPwdOpen = ref(false);
const categoryPwd = ref('');
const categoryPwdError = ref('');
const categoryPwdLoading = ref(false);

// Lightbox
const lightboxIdx = ref(-1);
const lightboxOpen = computed(() => lightboxIdx.value >= 0);
const lightboxPhoto = computed(() => photos.value[lightboxIdx.value]);

/* ---- 相冊內照片的擺放配置（由後台「版面配置」控制） ---- */
const { albumLayout, fetchSettings } = useSettings();
const photoLayout = computed(() => albumLayout.value.photos);

/** 間距檔位 → 實際數值 */
const GAP_PX: Record<string, string> = { sm: '0.4rem', md: '0.75rem', lg: '1.15rem' };
/** 裁剪比例 → CSS aspect-ratio */
const RATIO_CSS: Record<string, string> = {
  original: 'auto',
  square: '1 / 1',
  '4:3': '4 / 3',
  '3:4': '3 / 4',
  '16:9': '16 / 9',
};

const photoGridStyle = computed(() => {
  const cfg = photoLayout.value;
  const cols = typeof cfg.columns === 'number' ? Math.max(2, Math.min(6, cfg.columns)) : 3;
  return {
    '--ph-cols': String(cols),
    '--ph-gap': GAP_PX[cfg.gap] ?? GAP_PX.md,
    '--ph-ratio': RATIO_CSS[cfg.ratio] ?? 'auto',
    '--ph-radius': cfg.rounded ? '0.75rem' : '0px',
  };
});

function openLightbox(i: number) { lightboxIdx.value = i; }
function closeLightbox() { lightboxIdx.value = -1; }
function prev() { lightboxIdx.value = (lightboxIdx.value - 1 + photos.value.length) % photos.value.length; }
function next() { lightboxIdx.value = (lightboxIdx.value + 1) % photos.value.length; }

function onKey(e: KeyboardEvent) {
  if (!lightboxOpen.value) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
}

async function loadData() {
  loading.value = true;
  errMsg.value = '';
  try {
    category.value = await getAlbumCategory(catId.value);
    photos.value = await getAlbumPhotos(catId.value);
  } catch (e: any) {
    const status = e?.response?.status;
    const errorMsg = e?.response?.data?.error || '';
    if (status === 401) {
      if (errorMsg.includes('該分類需要密碼')) {
        // 分类需要独立密码，弹窗验证
        categoryPwdOpen.value = true;
        categoryPwd.value = '';
        categoryPwdError.value = '';
      } else {
        errMsg.value = $t('album.passwordExpired');
      }
    } else {
      errMsg.value = $t('album.loadFailed');
    }
  } finally {
    loading.value = false;
  }
}

async function onCategoryVerify() {
  categoryPwdError.value = '';
  if (!categoryPwd.value.trim()) { categoryPwdError.value = $t('album.passwordRequired'); return; }
  categoryPwdLoading.value = true;
  try {
    const ok = await verifyCategoryPassword(catId.value, categoryPwd.value.trim());
    if (ok) {
      categoryPwdOpen.value = false;
      // 重新加载数据
      await loadData();
    } else {
      categoryPwdError.value = $t('album.passwordWrong');
    }
  } catch {
    categoryPwdError.value = $t('album.verifyError');
  } finally {
    categoryPwdLoading.value = false;
  }
}

function closeCategoryPwd() {
  categoryPwdOpen.value = false;
  // 用户取消则返回相册列表
  goBack();
}

function goBack() {
  router.push('/album');
}

onMounted(() => {
  // 每次進入相冊頁都重新拉一次設置，避免後台改完版面配置後前台不刷新
  fetchSettings();
  loadData();
  window.addEventListener('keydown', onKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div class="album-detail mx-auto max-w-6xl px-4 py-10">
    <!-- 頭部 -->
    <header class="mb-6">
      <button
        type="button"
        class="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        @click="goBack"
      >
        <AppIcon name="chevron-left" class="size-4" />
        {{ $t('album.backToAlbum') }}
      </button>
      <div v-if="category" class="flex items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            {{ category.title }}
          </h1>
          <p v-if="category.desc" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ category.desc }}
          </p>
        </div>
        <span class="shrink-0 text-xs text-slate-400">
          {{ $tFmt('album.photoCount', { n: photos.length }) }}
        </span>
      </div>
    </header>

    <!-- 加載中 -->
    <div v-if="loading" class="py-20 text-center text-slate-400">{{ $t('common.loading') }}</div>

    <!-- 錯誤 -->
    <div v-else-if="errMsg" class="py-20 text-center text-rose-500">
      {{ errMsg }}
      <button
        type="button"
        class="ml-2 inline-flex items-center gap-1 underline hover:no-underline"
        @click="goBack"
      >
        <AppIcon name="chevron-left" class="size-3.5" />
        {{ $t('album.backToVerify') }}
      </button>
    </div>

    <!-- 空 -->
    <div v-else-if="!photos.length" class="py-20 text-center text-slate-400">
      {{ $t('album.noPhotos') }}
    </div>

    <!-- 照片網格 -->
    <div
      v-else
      class="photo-grid"
      :data-layout="photoLayout.layout"
      :data-ratio="photoLayout.ratio"
      :style="photoGridStyle"
    >
      <div
        v-for="(p, i) in photos"
        :key="p.id"
        class="photo-item"
        @click="openLightbox(i)"
      >
        <img
          :src="p.url"
          :alt="p.caption || p.id"
          loading="lazy"
          class="photo-img"
          @error="(e) => ((e.target as unknown as HTMLImageElement).style.opacity = '0.3')"
        />
        <div v-if="p.caption" class="photo-caption">{{ p.caption }}</div>
      </div>
    </div>

    <!-- Lightbox -->
    <Transition name="fade">
      <div
        v-if="lightboxOpen"
        class="lightbox"
        @click.self="closeLightbox"
      >
        <button
          type="button"
          class="lb-close"
          :aria-label="$t('common.close')"
          @click="closeLightbox"
        >
          <AppIcon name="close" class="size-5" />
        </button>
        <button
          type="button"
          class="lb-nav lb-prev"
          :aria-label="$t('album.prevPhoto')"
          @click="prev"
        >
          <AppIcon name="chevron-left" class="size-6" />
        </button>
        <button
          type="button"
          class="lb-nav lb-next"
          :aria-label="$t('album.nextPhoto')"
          @click="next"
        >
          <AppIcon name="chevron-right" class="size-6" />
        </button>
        <img
          v-if="lightboxPhoto"
          :src="lightboxPhoto.url"
          :alt="lightboxPhoto.caption || ''"
          class="lb-img"
        />
        <div v-if="lightboxPhoto?.caption" class="lb-caption">
          {{ lightboxPhoto.caption }}
        </div>
      </div>
    </Transition>

    <!-- 分類密碼驗證彈窗 -->
    <Transition name="fade">
      <div
        v-if="categoryPwdOpen"
        class="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
        @click.self="closeCategoryPwd"
      >
        <div class="modal-surface w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
            <AppIcon name="lock" class="size-6" />
          </div>
          <h2 class="mb-1 text-base font-semibold text-slate-900 dark:text-white">{{ $t('album.categoryNeedsPassword') }}</h2>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">{{ $t('album.categoryPasswordDesc') }}</p>
          <form @submit.prevent="onCategoryVerify">
            <input
              v-model="categoryPwd"
              type="password"
              :placeholder="$t('album.categoryPasswordPlaceholder')"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              autocomplete="off"
              autofocus
            />
            <button
              type="submit"
              class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 py-2 text-sm font-medium text-white transition-all hover:shadow-lg disabled:opacity-60"
              :disabled="categoryPwdLoading"
            >
              <AppIcon :name="categoryPwdLoading ? 'refresh-cw' : 'check'" class="size-4" />
              <span v-if="!categoryPwdLoading">{{ $t('album.verifyAndEnter') }}</span>
              <span v-else>{{ $t('album.verifying') }}</span>
            </button>
          </form>
          <p v-if="categoryPwdError" class="mt-2 text-xs text-rose-500">{{ categoryPwdError }}</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="closeCategoryPwd"
          >
            <AppIcon name="chevron-left" class="size-3.5" />
            {{ $t('album.backToAlbum') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== 照片佈局（由後台「版面配置」控制） ===== */
/* 瀑布流：多列排布，保留原圖比例 */
.photo-grid {
  column-count: var(--ph-cols, 3);
  column-gap: var(--ph-gap, 0.75rem);
}

/* 等寬網格：等高排列，可指定裁剪比例 */
.photo-grid[data-layout='grid'] {
  display: grid;
  grid-template-columns: repeat(var(--ph-cols, 3), minmax(0, 1fr));
  gap: var(--ph-gap, 0.75rem);
  align-items: start;
}

.photo-item {
  break-inside: avoid;
  margin-bottom: var(--ph-gap, 0.75rem);
  border-radius: var(--ph-radius, 0.75rem);
  overflow: hidden;
  cursor: zoom-in;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  background: rgba(var(--accent-1-rgb), 0.05);
}
.photo-grid[data-layout='grid'] .photo-item {
  margin-bottom: 0;
}
.photo-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px -12px rgba(var(--accent-1-rgb), 0.4);
}

/* 指定裁剪比例時才固定高度並裁切；original 保留原圖比例 */
.photo-grid[data-layout='grid'][data-ratio]:not([data-ratio='original']) .photo-item {
  aspect-ratio: var(--ph-ratio, 1 / 1);
}
.photo-grid[data-layout='grid'][data-ratio]:not([data-ratio='original']) .photo-img {
  height: 100%;
  object-fit: cover;
}

.photo-img {
  width: 100%;
  display: block;
  transition: transform 0.4s ease;
}
.photo-item:hover .photo-img { transform: scale(1.03); }

@media (max-width: 1024px) {
  .photo-grid { column-count: 2; }
  .photo-grid[data-layout='grid'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .photo-grid { column-count: 1; }
  .photo-grid[data-layout='grid'] { grid-template-columns: 1fr; }
}

.photo-caption {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  color: #fff;
  background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}
.photo-item:hover .photo-caption { opacity: 1; }

/* ===== Lightbox ===== */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.lb-img {
  max-width: 90vw;
  max-height: 85vh;
  border-radius: 0.5rem;
  object-fit: contain;
}
.lb-caption {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
}
.lb-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s;
}
.lb-close:hover { background: rgba(255, 255, 255, 0.3); }

.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s;
}
.lb-nav:hover { background: rgba(255, 255, 255, 0.25); }
.lb-prev { left: 1.5rem; }
.lb-next { right: 1.5rem; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
