<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { Post, PostBlock } from '../../types';
import BlockEditor from './BlockEditor.vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{ post: Post | null }>();
const emit = defineEmits<{ save: [payload: Partial<Post>]; cancel: [] }>();

const form = reactive({
  title: props.post?.title ?? '',
  category: (props.post?.category ?? 'blog') as 'blog' | 'essay',
  date: props.post?.date ?? new Date().toISOString().slice(0, 10),
  tagsText: (props.post?.tags ?? []).join(', '),
  summary: props.post?.summary ?? '',
  readMinutes: String(props.post?.readMinutes ?? 5),
});
const blocks = ref<PostBlock[]>(
  props.post?.blocks?.length ? JSON.parse(JSON.stringify(props.post.blocks)) : []
);

function save() {
  if (!form.title.trim()) return;
  emit('save', {
    id: props.post?.id,
    category: form.category,
    title: form.title.trim(),
    date: form.date,
    tags: form.tagsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8),
    summary: form.summary.trim(),
    readMinutes: Math.max(1, Number(form.readMinutes) || 5),
    blocks: blocks.value,
  });
}
</script>

<template>
  <div class="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4" @click.self="emit('cancel')">
    <div
      class="modal-surface mx-auto my-6 w-full max-w-2xl rounded-3xl p-6 shadow-2xl md:p-8"
      role="dialog"
      aria-label="编辑文章"
    >
      <div class="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/60">
        <h2 class="flex items-center gap-2 text-lg font-bold">
          <AppIcon :name="post ? 'pen' : 'plus'" class="size-5 text-cyan-600 dark:text-cyan-400" />
          {{ post ? '编辑文章' : '新增文章' }}
        </h2>
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="关闭"
          @click="emit('cancel')"
        >
          <AppIcon name="close" class="size-5" />
        </button>
      </div>

      <div class="mt-6 space-y-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium">标题 *</label>
          <input
            v-model="form.title"
            type="text"
            maxlength="120"
            placeholder="文章标题"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium">栏目 *</label>
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
                :class="
                  form.category === 'blog'
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                    : 'border-slate-200 text-slate-500 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-400'
                "
                @click="form.category = 'blog'"
              >
                <AppIcon name="book" class="size-4" />
                博客
              </button>
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
                :class="
                  form.category === 'essay'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 text-slate-500 hover:border-amber-300 dark:border-slate-700 dark:text-slate-400'
                "
                @click="form.category = 'essay'"
              >
                <AppIcon name="pen" class="size-4" />
                随笔
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">日期</label>
            <input
              v-model="form.date"
              type="date"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">阅读时长（分钟）</label>
            <input
              v-model="form.readMinutes"
              type="number"
              min="1"
              max="120"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">标签（逗号分隔）</label>
          <input
            v-model="form.tagsText"
            type="text"
            placeholder="Vue 3, 工程化"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">摘要</label>
          <textarea
            v-model="form.summary"
            rows="2"
            maxlength="300"
            placeholder="显示在文章卡片上的一句话摘要"
            class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">正文内容</label>
          <BlockEditor v-model="blocks" />
        </div>
      </div>

      <div class="mt-8 flex justify-end gap-3 border-t border-slate-200/70 pt-5 dark:border-slate-700/60">
        <button type="button" class="btn-ghost" @click="emit('cancel')">
          <AppIcon name="close" class="size-4" />
          取消
        </button>
        <button type="button" class="btn-primary" @click="save">
          <AppIcon name="check" class="size-4" />
          保存
        </button>
      </div>
    </div>
  </div>
</template>
