<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Note } from '../types';
import {
  adminLogin,
  adminUploadNoteImages,
  adminCreateNote,
  adminUpdateNote,
  getAdminToken,
  setAdminToken,
} from '../api';
import AppIcon from './ui/AppIcon.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt } = useI18n();
const props = withDefaults(defineProps<{ note?: Note | null }>(), { note: null });
const emit = defineEmits<{ saved: []; cancel: [] }>();

const MAX_IMAGES = 9;
const MAX_SIZE = 8 * 1024 * 1024;

const isEdit = !!props.note;

const title = ref(props.note?.title ?? '');
const content = ref(props.note?.content ?? '');
const tagsText = ref((props.note?.tags ?? []).join(' '));
// 已有图片（编辑模式回填） + 新选图片（object URL 预览）
const existingImages = ref<string[]>([...(props.note?.images ?? [])]);
const files = ref<File[]>([]);
const previews = ref<string[]>([]);
const busy = ref(false);
const err = ref('');

// 未登录时展示内嵌登录（发布/编辑需要后台管理权限）
const needLogin = ref(!getAdminToken());
const password = ref('');
const loginErr = ref('');

const totalCount = computed(() => existingImages.value.length + files.value.length);

function pickImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif';
  input.multiple = true;
  input.onchange = () => {
    const list = Array.from(input.files ?? []);
    for (const f of list) {
      if (totalCount.value >= MAX_IMAGES) break;
      if (f.size > MAX_SIZE) {
        err.value = $tFmt('notes.editor.fileTooLarge', { name: f.name });
        continue;
      }
      files.value.push(f);
      previews.value.push(URL.createObjectURL(f));
    }
    if (!err.value) err.value = '';
  };
  input.click();
}

function removeExisting(i: number) {
  existingImages.value.splice(i, 1);
}

function removeNew(i: number) {
  URL.revokeObjectURL(previews.value[i]);
  files.value.splice(i, 1);
  previews.value.splice(i, 1);
}

async function ensureLogin() {
  if (getAdminToken()) return true;
  loginErr.value = '';
  if (!password.value) {
    loginErr.value = $t('notes.editor.pleaseEnterPassword');
    return false;
  }
  try {
    const { token } = await adminLogin(password.value);
    setAdminToken(token);
    needLogin.value = false;
    password.value = '';
    return true;
  } catch (e: any) {
    loginErr.value = e?.response?.data?.error ?? $t('notes.editor.loginFailed');
    return false;
  }
}

async function save() {
  err.value = '';
  loginErr.value = '';
  if (!title.value.trim()) {
    err.value = $t('notes.editor.pleaseEnterTitle');
    return;
  }
  if (!totalCount.value) {
    err.value = $t('notes.editor.pleaseKeepOneImage');
    return;
  }
  busy.value = true;
  try {
    if (!(await ensureLogin())) {
      busy.value = false;
      return;
    }
    const newUrls = files.value.length
      ? (await adminUploadNoteImages(files.value)).urls
      : [];
    const payload = {
      title: title.value.trim(),
      content: content.value.trim(),
      images: [...existingImages.value, ...newUrls],
      tags: tagsText.value
        .split(/[，#\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10),
    };
    if (isEdit) await adminUpdateNote(props.note!.id, payload);
    else await adminCreateNote(payload);
    emit('saved');
  } catch (e: any) {
    err.value = e?.response?.data?.error ?? (isEdit ? $t('notes.editor.saveFailed') : $t('notes.editor.publishFailed'));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div
    class="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4"
    @click.self="emit('cancel')"
  >
    <div
      class="modal-surface mx-auto my-6 w-full max-w-4xl rounded-3xl p-5 shadow-2xl md:my-10 md:p-7"
      role="dialog"
      :aria-label="isEdit ? $t('notes.editor.editTitle') : $t('notes.editor.publishTitle')"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/60">
        <div class="flex items-center gap-2.5">
          <span class="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-red-400 to-orange-400 text-white shadow-lg shadow-red-500/25">
            <AppIcon name="camera" class="size-5" />
          </span>
          <h2 class="text-lg font-bold">{{ isEdit ? $t('notes.editor.editTitle') : $t('notes.editor.publishTitle') }}</h2>
        </div>
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          :aria-label="$t('common.close')"
          @click="emit('cancel')"
        >
          <AppIcon name="close" class="size-5" />
        </button>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <!-- 左侧：图片九宫格 -->
        <div>
          <p class="mb-2 text-sm font-medium">
            {{ $t('notes.editor.image') }}
            <span class="text-xs font-normal text-slate-400">{{ $tFmt('notes.editor.imageHint', { current: totalCount, max: MAX_IMAGES }) }}</span>
          </p>
          <div class="grid grid-cols-3 gap-2">
            <!-- 已有图片 -->
            <button
              v-for="(url, i) in existingImages"
              :key="`e${i}`"
              type="button"
              class="group relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              :aria-label="$tFmt('notes.editor.removeImage', { n: i + 1 })"
              @click="removeExisting(i)"
            >
              <img :src="url" :alt="$tFmt('notes.editor.removeImage', { n: i + 1 })" class="size-full object-cover" />
              <span
                v-if="i === 0"
                class="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                {{ $t('notes.editor.cover') }}
              </span>
              <span class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                <AppIcon name="trash" class="size-5 text-white" />
              </span>
            </button>
            <!-- 新选图片 -->
            <button
              v-for="(url, i) in previews"
              :key="`n${url}`"
              type="button"
              class="group relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              :aria-label="$tFmt('notes.editor.newImage', { n: i + 1 })"
              @click="removeNew(i)"
            >
              <img :src="url" :alt="$tFmt('notes.editor.newImage', { n: i + 1 })" class="size-full object-cover" />
              <span class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                <AppIcon name="trash" class="size-5 text-white" />
              </span>
            </button>
            <button
              v-if="totalCount < MAX_IMAGES"
              type="button"
              class="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-red-400 hover:text-red-500 dark:border-slate-700"
              @click="pickImage"
            >
              <AppIcon name="camera" class="size-6" />
              <span class="text-xs">{{ $t('notes.editor.addImage') }}</span>
            </button>
          </div>
          <p v-if="isEdit" class="mt-2 text-xs text-slate-400">
            {{ $t('notes.editor.hoverToRemove') }}
          </p>
        </div>

        <!-- 右侧：文案 -->
        <div class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium">{{ $t('notes.editor.titleLabel') }}</label>
            <input
              v-model="title"
              type="text"
              maxlength="60"
              :placeholder="$t('notes.editor.titlePlaceholder')"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">{{ $t('notes.editor.contentLabel') }}</label>
            <textarea
              v-model="content"
              rows="5"
              maxlength="1000"
              :placeholder="$t('notes.editor.contentPlaceholder')"
              class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">{{ $t('notes.editor.tagsLabel') }}</label>
            <input
              v-model="tagsText"
              type="text"
              :placeholder="$t('notes.editor.tagsPlaceholder')"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <p v-if="err" class="flex items-center gap-1.5 text-sm text-red-500">
            <AppIcon name="alert-circle" class="size-4" />
            {{ err }}
          </p>
          <p v-else class="text-xs leading-relaxed text-slate-400">
            {{ isEdit ? $t('notes.editor.editHint') : $t('notes.editor.publishHint') }}
          </p>

          <!-- 未登录：内嵌登录 -->
          <div v-if="needLogin" class="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4">
            <p class="text-xs font-medium text-amber-700 dark:text-amber-400">
              {{ isEdit ? $t('notes.editor.needLoginEdit') : $t('notes.editor.needLoginPublish') }}
            </p>
            <input
              v-model="password"
              type="password"
              :placeholder="$t('notes.editor.passwordPlaceholder')"
              class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              @keydown.enter="save"
            />
            <p v-if="loginErr" class="mt-1.5 text-xs text-red-500">{{ loginErr }}</p>
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
            <button type="button" class="btn-ghost" @click="emit('cancel')">
              <AppIcon name="close" class="size-4" />
              {{ $t('notes.editor.cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-transform hover:scale-105 disabled:opacity-60"
              :disabled="busy"
              @click="save"
            >
              <AppIcon :name="isEdit ? 'check' : 'send'" class="size-4" />
              {{ busy ? (isEdit ? $t('notes.editor.saving') : $t('notes.editor.publishing')) : isEdit ? $t('notes.editor.saveChanges') : $t('notes.editor.publish') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
