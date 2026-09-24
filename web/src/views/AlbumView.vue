<script setup lang="ts">
/**
 * AlbumView — 私密相册列表页。
 * 首次進入需輸入密碼 1126，驗證成功後顯示 Bending Gallery 風格的相冊分類。
 * 部分分類可能有獨立密碼保護，點擊時需要額外驗證。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BendingGallery from '../components/ui/BendingGallery.vue';
import { getAlbumCategories, verifyAlbumPassword, verifyCategoryPassword, type AlbumCategory } from '../api/album';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';
import { useSettings } from '../composables/useSettings';

const { $t, $tFmt } = useI18n();
const router = useRouter();
const authed = ref(false);
const password = ref('');
const pwdError = ref('');
const loading = ref(false);
const categories = ref<AlbumCategory[]>([]);

/** 版面配置由後台控制，接口異常時回退默認值 */
const { albumLayout, fetchSettings } = useSettings();

/** 所有相冊的照片總數，用於頁頭統計 */
const totalPhotos = computed(() =>
  categories.value.reduce((sum, c) => sum + (c.photoCount || 0), 0),
);

// 分類密碼驗證彈窗
const categoryPwdOpen = ref(false);
const categoryPwd = ref('');
const categoryPwdError = ref('');
const categoryPwdLoading = ref(false);
const pendingCategoryId = ref('');

async function onVerify() {
  pwdError.value = '';
  if (!password.value.trim()) { pwdError.value = $t('album.passwordRequired'); return; }
  loading.value = true;
  try {
    const ok = await verifyAlbumPassword(password.value.trim());
    if (ok) {
      authed.value = true;
      await loadCategories();
    } else {
      pwdError.value = $t('album.passwordWrong');
    }
  } catch {
    pwdError.value = $t('album.verifyError');
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  try {
    categories.value = await getAlbumCategories();
  } catch {
    // 401 未驗證
  }
}

function openCategory(item: { id: string; hasPassword?: boolean }) {
  if (item.hasPassword) {
    // 有密碼保護，彈窗驗證
    pendingCategoryId.value = item.id;
    categoryPwd.value = '';
    categoryPwdError.value = '';
    categoryPwdOpen.value = true;
  } else {
    router.push(`/album/${item.id}`);
  }
}

async function onCategoryVerify() {
  categoryPwdError.value = '';
  if (!categoryPwd.value.trim()) { categoryPwdError.value = $t('album.passwordRequired'); return; }
  categoryPwdLoading.value = true;
  try {
    const ok = await verifyCategoryPassword(pendingCategoryId.value, categoryPwd.value.trim());
    if (ok) {
      categoryPwdOpen.value = false;
      router.push(`/album/${pendingCategoryId.value}`);
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
  pendingCategoryId.value = '';
}

onMounted(async () => {
  // 每次進入相冊頁都重新拉一次設置，避免後台改完版面配置後前台不刷新
  fetchSettings();
  // 嘗試自動驗證（cookie 仍有效）
  try {
    const list = await getAlbumCategories();
    if (list) {
      authed.value = true;
      categories.value = list;
    }
  } catch {
    // 需要密碼
  }
});
</script>

<template>
  <div class="album-page mx-auto max-w-6xl px-4 py-12">
    <!-- 未驗證：密碼鎖 -->
    <div v-if="!authed" class="pwd-lock">
      <div class="pwd-card">
        <div class="pwd-icon">
          <AppIcon name="lock" class="size-8" />
        </div>
        <h1 class="pwd-title">{{ $t('album.privateTitle') }}</h1>
        <p class="pwd-sub">{{ $t('album.privateDesc') }}</p>
        <form class="pwd-form" @submit.prevent="onVerify">
          <input
            v-model="password"
            type="password"
            :placeholder="$t('album.passwordPlaceholder')"
            class="pwd-input"
            autocomplete="off"
            autofocus
          />
          <button
            type="submit"
            class="pwd-btn inline-flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <AppIcon :name="loading ? 'refresh-cw' : 'check'" class="size-4" />
            <span v-if="!loading">{{ $t('album.enter') }}</span>
            <span v-else>{{ $t('album.verifying') }}</span>
          </button>
        </form>
        <p v-if="pwdError" class="pwd-error">{{ pwdError }}</p>
      </div>
    </div>

    <!-- 已驗證：彎曲畫廊 -->
    <template v-else>
      <header class="album-head mb-6">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              {{ $t('album.privateTitle') }}
            </h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ $t('album.myMemories') }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span
              v-if="categories.length"
              class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {{ $tFmt('album.stats', { c: categories.length, p: totalPhotos }) }}
            </span>
            <span class="album-verified">
              <AppIcon name="lock" class="size-3.5" />
              {{ $t('album.verified') }}
            </span>
          </div>
        </div>
      </header>

      <BendingGallery
        :items="categories.map((c) => ({
          id: c.id,
          image: c.cover || '',
          title: c.title,
          subtitle: c.desc,
          hasPassword: c.hasPassword,
          count: c.photoCount,
        }))"
        :layout="albumLayout.wall"
        @item-click="openCategory"
      />
    </template>

    <!-- 分類密碼驗證彈窗 -->
    <Transition name="fade">
      <div
        v-if="categoryPwdOpen"
        class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeCategoryPwd"
      >
        <div class="pwd-card" style="max-width: 320px;">
          <div class="pwd-icon" style="width: 44px; height: 44px; margin-bottom: 0.75rem;">
            <AppIcon name="lock" class="size-6" />
          </div>
          <h2 class="pwd-title" style="font-size: 1.1rem;">{{ $t('album.categoryNeedsPassword') }}</h2>
          <p class="pwd-sub">{{ $t('album.categoryPasswordDesc') }}</p>
          <form class="pwd-form" @submit.prevent="onCategoryVerify">
            <input
              v-model="categoryPwd"
              type="password"
              :placeholder="$t('album.categoryPasswordPlaceholder')"
              class="pwd-input"
              autocomplete="off"
              autofocus
            />
            <button
              type="submit"
              class="pwd-btn inline-flex items-center justify-center gap-2"
              :disabled="categoryPwdLoading"
            >
              <AppIcon :name="categoryPwdLoading ? 'refresh-cw' : 'check'" class="size-4" />
              <span v-if="!categoryPwdLoading">{{ $t('album.verifyAndEnter') }}</span>
              <span v-else>{{ $t('album.verifying') }}</span>
            </button>
          </form>
          <p v-if="categoryPwdError" class="pwd-error">{{ categoryPwdError }}</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="closeCategoryPwd"
          >
            <AppIcon name="chevron-left" class="size-3.5" />
            {{ $t('album.cancel') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== 密碼鎖 ===== */
.pwd-lock {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.pwd-card {
  width: 100%;
  max-width: 360px;
  padding: 2.5rem 2rem;
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--accent-1-rgb), 0.15);
  box-shadow: 0 20px 48px -16px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.pwd-icon {
  display: inline-flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  box-shadow: 0 8px 24px -8px rgba(var(--accent-1-rgb), 0.5);
}

.pwd-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--accent-1);
}

.pwd-sub {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.35rem;
}

.pwd-form {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pwd-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.6);
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.pwd-input:focus {
  border-color: var(--accent-1);
  box-shadow: 0 0 0 3px rgba(var(--accent-1-rgb), 0.15);
}
:global(.dark) .pwd-input {
  border-color: #334155;
  background: rgba(15, 23, 42, 0.6);
  color: #f1f5f9;
}

.pwd-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  box-shadow: 0 8px 24px -8px rgba(var(--accent-1-rgb), 0.5);
}
.pwd-btn:hover:not(:disabled) { transform: translateY(-1px); }
.pwd-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.pwd-error {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #ef4444;
}

/* ===== 頁頭 ===== */
.album-verified {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--accent-1);
  background: rgba(var(--accent-1-rgb), 0.1);
  border: 1px solid rgba(var(--accent-1-rgb), 0.22);
}
</style>
