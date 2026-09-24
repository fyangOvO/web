<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getNotes, likeNote, getNoteComments, postNoteComment, getAdminToken } from '../api';
import type { Note, Comment } from '../types';
import NoteComposer from '../components/NoteComposer.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import AvatarBadge from '../components/ui/AvatarBadge.vue';
import { useI18n } from '../composables/useI18n';

const { $t, $tFmt, lang } = useI18n();

const notes = ref<Note[]>([]);
const activeTag = ref('');
const loading = ref(true);
const composerOpen = ref(false);
const editTarget = ref<Note | null>(null);
const detail = ref<Note | null>(null);
const liked = ref<Set<string>>(new Set());
const toast = ref('');

// 评论
const comments = ref<Comment[]>([]);
const commentBusy = ref(false);
const commentErr = ref('');
const cf = ref({ name: '', content: '', website: '' });

function showToast(msg: string) {
  toast.value = msg;
  window.setTimeout(() => (toast.value = ''), 2200);
}

const tags = computed(() => {
  const map = new Map<string, number>();
  notes.value.forEach((n) => (n.tags || []).forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
});

const filtered = computed(() =>
  activeTag.value ? notes.value.filter((n) => (n.tags || []).includes(activeTag.value)) : notes.value
);

async function load() {
  loading.value = true;
  try {
    notes.value = await getNotes();
  } catch {
    showToast($t('notes.loadError'));
  } finally {
    loading.value = false;
  }
}

function toggleLike(n: Note) {
  const isLiked = liked.value.has(n.id);
  likeNote(n.id, isLiked ? 'unlike' : 'like')
    .then((r) => {
      n.likes = r.likes;
    })
    .catch(() => showToast($t('notes.actionError')));
  if (isLiked) liked.value.delete(n.id);
  else liked.value.add(n.id);
  try {
    localStorage.setItem('liked_notes', JSON.stringify([...liked.value]));
  } catch {
    /* ignore */
  }
}

function onSaved() {
  composerOpen.value = false;
  load();
  showToast($t('notes.publishSuccess'));
}

async function openDetail(n: Note) {
  detail.value = n;
  await loadComments(n.id);
}

async function loadComments(noteId: string) {
  try {
    comments.value = await getNoteComments(noteId);
  } catch {
    comments.value = [];
  }
}

async function submitComment() {
  if (!detail.value) return;
  commentErr.value = '';
  if (!cf.value.name.trim() || !cf.value.content.trim()) {
    commentErr.value = $t('notes.commentNameRequired');
    return;
  }
  commentBusy.value = true;
  try {
    await postNoteComment(detail.value.id, {
      name: cf.value.name.trim(),
      content: cf.value.content.trim(),
      website: cf.value.website,
    });
    cf.value.content = '';
    await loadComments(detail.value.id);
  } catch (e: any) {
    commentErr.value = e?.response?.data?.error ?? $t('notes.commentError');
  } finally {
    commentBusy.value = false;
  }
}

async function onEditSaved() {
  editTarget.value = null;
  await load();
  if (detail.value) {
    detail.value = notes.value.find((n) => n.id === detail.value!.id) ?? null;
  }
  showToast($t('notes.saveSuccess'));
}

function fmtTime(iso: string) {
  try {
    const locale = lang.value === 'en' ? 'en-US' : lang.value === 'zh-Hans' ? 'zh-CN' : 'zh-TW';
    return new Date(iso).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

onMounted(async () => {
  load();
  try {
    liked.value = new Set(JSON.parse(localStorage.getItem('liked_notes') ?? '[]'));
  } catch {
    /* ignore */
  }
});
</script>

<template>
  <div class="shell pb-20 pt-28 md:pt-32">
    <!-- 头部 -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold tracking-widest text-red-500">NOTE · {{ $t('nav.notes') }}</p>
        <h1 class="mt-1 text-2xl font-bold md:text-3xl">{{ $t('notes.title') }}</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {{ $t('notes.subtitle') }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-transform hover:scale-105"
        @click="composerOpen = true"
      >
        <AppIcon name="camera" class="size-4" />
        {{ $t('notes.publish') }}
      </button>
    </div>

    <!-- 标签筛选 -->
    <div class="mt-6 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
        :class="
          activeTag === ''
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25'
            : 'glass text-slate-600 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400'
        "
        @click="activeTag = ''"
      >
        {{ $t('common.all') }}
      </button>
      <button
        v-for="t in tags"
        :key="t"
        type="button"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
        :class="
          activeTag === t
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25'
            : 'glass text-slate-600 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400'
        "
        @click="activeTag = t"
      >
        #{{ t }}
      </button>
    </div>

    <!-- 加载骨架 -->
    <div v-if="loading" class="mt-8 columns-2 gap-4 lg:columns-3 xl:columns-4">
      <div v-for="i in 6" :key="i" class="mb-4 break-inside-avoid">
        <div class="skeleton aspect-[3/4] rounded-2xl" />
        <div class="skeleton mt-3 h-4 w-4/5 rounded-md" />
      </div>
    </div>

    <!-- 瀑布流 -->
    <div v-else-if="filtered.length" class="mt-8 columns-2 gap-4 lg:columns-3 xl:columns-4">
      <article
        v-for="n in filtered"
        :key="n.id"
        class="group mb-4 cursor-pointer break-inside-avoid"
        @click="openDetail(n)"
      >
        <div class="relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm dark:bg-slate-800">
          <img
            :src="n.images[0]"
            :alt="n.title"
            class="w-full transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <span
            v-if="n.images.length > 1"
            class="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white"
          >
            <AppIcon name="layers" class="size-3" />
            {{ n.images.length }}
          </span>
        </div>
        <h3 class="mt-2.5 line-clamp-2 text-sm font-medium leading-snug">{{ n.title }}</h3>
        <p v-if="n.content" class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {{ n.content }}
        </p>
        <div class="mt-2.5 flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            <AvatarBadge :text="n.author" size="sm" />
            <span class="truncate text-xs text-slate-500 dark:text-slate-400">{{ n.author }}</span>
          </span>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-500 transition-colors hover:text-red-500 dark:text-slate-400"
            :aria-label="liked.has(n.id) ? $t('notes.unlike') : $t('notes.like')"
            @click.stop="toggleLike(n)"
          >
            <AppIcon
              name="heart"
              class="size-4"
              :class="liked.has(n.id) ? 'fill-red-500 stroke-red-500' : ''"
            />
            {{ n.likes }}
          </button>
        </div>
      </article>
    </div>

    <!-- 空状态 -->
    <div v-else class="mt-16 flex flex-col items-center py-16 text-center">
      <span class="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-red-400/15 to-orange-400/15 text-red-400">
        <AppIcon name="camera" class="size-9" />
      </span>
      <p class="mt-5 font-semibold">{{ activeTag ? $t('notes.noNotesTag') : $t('notes.noNotes') }}</p>
      <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{{ $t('notes.publishFirst') }}</p>
      <button
        type="button"
        class="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-transform hover:scale-105"
        @click="composerOpen = true"
      >
        <AppIcon name="camera" class="size-4" />
        {{ $t('notes.publish') }}
      </button>
    </div>

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div
        v-if="detail"
        class="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4"
        @click.self="detail = null"
      >
        <div class="modal-surface mx-auto my-6 w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-200/60 px-5 py-3.5 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <AvatarBadge :text="detail.author" size="sm" />
              <div>
                <p class="text-sm font-semibold leading-tight">{{ detail.author }}</p>
                <p class="text-xs text-slate-400">{{ detail.date }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="getAdminToken()"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-300/60 px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-400 hover:text-red-500 dark:border-slate-700 dark:text-slate-300"
                @click="editTarget = detail"
              >
                <AppIcon name="edit" class="size-3.5" />
                {{ $t('notes.edit') }}
              </button>
              <button
                type="button"
                class="grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                :aria-label="$t('common.close')"
                @click="detail = null"
              >
                <AppIcon name="close" class="size-5" />
              </button>
            </div>
          </div>

          <div class="max-h-[70vh] overflow-y-auto p-5">
            <div v-if="detail.images.length > 1" class="grid gap-2 sm:grid-cols-2">
              <img
                v-for="(img, i) in detail.images"
                :key="img"
                :src="img"
                :alt="`${detail!.title} ${i + 1}`"
                class="w-full rounded-xl"
              />
            </div>
            <img
              v-else
              :src="detail.images[0]"
              :alt="detail.title"
              class="w-full rounded-xl"
            />

            <h2 class="mt-4 text-lg font-bold">{{ detail.title }}</h2>
            <div class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="t in detail.tags"
                :key="t"
                class="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500"
              >
                #{{ t }}
              </span>
            </div>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {{ detail.content }}
            </p>

            <button
              type="button"
              class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-red-300/60 px-5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
              @click="toggleLike(detail)"
            >
              <AppIcon name="heart" class="size-4" :class="liked.has(detail.id) ? 'fill-red-500 stroke-red-500' : ''" />
              {{ $tFmt('notes.likesCount', { n: detail.likes }) }}
            </button>

            <!-- 评论区 -->
            <div class="mt-8 border-t border-slate-200/70 pt-6 dark:border-slate-800">
              <h3 class="flex items-center gap-2 text-sm font-semibold">
                <AppIcon name="message" class="size-4 text-red-500" />
                {{ $t('notes.comment') }}
                <span class="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">{{ comments.length }}</span>
              </h3>

              <div class="mt-4 space-y-4">
                <div v-for="c in comments" :key="c.id" class="flex gap-3">
                  <AvatarBadge :text="c.name" size="sm" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                      <span class="text-sm font-semibold">{{ c.name }}</span>
                      <span class="text-xs text-slate-400">{{ fmtTime(c.date) }}</span>
                    </div>
                    <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {{ c.content }}
                    </p>
                  </div>
                </div>
                <p v-if="!comments.length" class="py-4 text-center text-xs text-slate-400">
                  {{ $t('notes.noComments') }}
                </p>
              </div>

              <!-- 发表评论 -->
              <div class="mt-5 rounded-2xl border border-slate-200/70 bg-white/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <input
                  v-model="cf.name"
                  type="text"
                  maxlength="20"
                  :placeholder="$t('notes.nicknamePlaceholder')"
                  class="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                />
                <!-- honeypot -->
                <input
                  v-model="cf.website"
                  type="text"
                  tabindex="-1"
                  autocomplete="off"
                  class="absolute -left-[9999px] h-0 w-0 opacity-0"
                  aria-hidden="true"
                />
                <textarea
                  v-model="cf.content"
                  rows="3"
                  maxlength="300"
                  :placeholder="$t('notes.commentPlaceholder')"
                  class="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                />
                <div class="mt-2 flex items-center justify-between gap-3">
                  <p v-if="commentErr" class="flex items-center gap-1 text-xs text-red-500">
                    <AppIcon name="alert-circle" class="size-3.5" />
                    {{ commentErr }}
                  </p>
                  <span v-else class="text-xs text-slate-400">{{ $t('notes.commentMax') }}</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition-transform hover:scale-105 disabled:opacity-60"
                    :disabled="commentBusy"
                    @click="submitComment"
                  >
                    <AppIcon name="send" class="size-3.5" />
                    {{ commentBusy ? $t('notes.commentSending') : $t('notes.postComment') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 发布弹窗 -->
    <NoteComposer v-if="composerOpen" @saved="onSaved" @cancel="composerOpen = false" />
    <!-- 编辑弹窗 -->
    <NoteComposer v-if="editTarget" :note="editTarget" @saved="onEditSaved" @cancel="editTarget = null" />

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-2xl dark:bg-slate-100 dark:text-slate-900"
      >
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
