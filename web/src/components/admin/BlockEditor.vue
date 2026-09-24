<script setup lang="ts">
import type { PostBlock } from '../../types';
import AppIcon from '../ui/AppIcon.vue';

/**
 * 文章正文块编辑器：p / h2 / h3 / quote / tip / code / list
 * v-model 绑定 PostBlock[]。
 */
const model = defineModel<PostBlock[]>({ required: true });

const TYPE_OPTIONS = [
  { value: 'p', label: '段落' },
  { value: 'h2', label: '二级标题' },
  { value: 'h3', label: '三级标题' },
  { value: 'quote', label: '引用' },
  { value: 'tip', label: '提示框' },
  { value: 'code', label: '代码块' },
  { value: 'list', label: '列表' },
];

function addBlock() {
  model.value = [...(model.value || []), { type: 'p', content: '' }];
}

function removeBlock(i: number) {
  model.value = (model.value || []).filter((_, j) => j !== i);
}

function moveBlock(i: number, dir: number) {
  const arr = [...(model.value || [])];
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
  model.value = arr;
}

function setListText(row: PostBlock, value: string) {
  row.items = value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(row, i) in model"
      :key="i"
      class="rounded-xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-900/50"
    >
      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model="row.type"
          class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-if="row.type === 'code'"
          v-model="row.lang"
          type="text"
          placeholder="语言，如 bash / css / js"
          class="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <span class="ml-auto flex items-center gap-1">
          <button
            type="button"
            class="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-slate-800"
            :disabled="i === 0"
            aria-label="上移"
            @click="moveBlock(i, -1)"
          >
            <AppIcon name="chevron-down" class="size-4 rotate-180" />
          </button>
          <button
            type="button"
            class="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-slate-800"
            :disabled="i === (model || []).length - 1"
            aria-label="下移"
            @click="moveBlock(i, 1)"
          >
            <AppIcon name="chevron-down" class="size-4" />
          </button>
          <button
            type="button"
            class="grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            aria-label="删除该块"
            @click="removeBlock(i)"
          >
            <AppIcon name="close" class="size-4" />
          </button>
        </span>
      </div>

      <textarea
        v-if="row.type === 'list'"
        :value="(row.items ?? []).join('\n')"
        rows="3"
        placeholder="每行一个列表项"
        class="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        @input="setListText(row, ($event.target as HTMLTextAreaElement).value)"
      />
      <textarea
        v-else
        v-model="row.content"
        :rows="row.type === 'code' ? 5 : 3"
        :placeholder="row.type === 'code' ? '代码内容…' : '内容…'"
        class="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
    </div>

    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-cyan-400"
      @click="addBlock"
    >
      <AppIcon name="plus" class="size-4" />
      添加内容块
    </button>
  </div>
</template>
