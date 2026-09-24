<script setup lang="ts">
import { reactive } from 'vue';
import type { Project } from '../../types';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{ project: Project | null }>();
const emit = defineEmits<{ save: [payload: Partial<Project>]; cancel: [] }>();

const GRADIENTS = [
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'linear-gradient(135deg,#06b6d4,#0ea5e9)',
  'linear-gradient(135deg,#22c55e,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#14b8a6,#0ea5e9)',
  'linear-gradient(135deg,#8b5cf6,#3b82f6)',
];

const ICONS = [
  'code', 'layers', 'server', 'pen', 'book', 'box', 'chart', 'grid',
  'terminal', 'rocket', 'home', 'camera', 'coffee', 'shield',
];

const form = reactive({
  title: props.project?.title ?? '',
  desc: props.project?.desc ?? '',
  techText: (props.project?.tech ?? []).join(', '),
  tagsText: (props.project?.tags ?? []).join(', '),
  repo: props.project?.repo ?? 'https://github.com/yourname',
  demo: props.project?.demo ?? '#',
  gradient: props.project?.gradient ?? GRADIENTS[1],
  icon: props.project?.icon ?? 'code',
  featured: props.project?.featured ?? false,
});

function save() {
  if (!form.title.trim()) return;
  emit('save', {
    id: props.project?.id,
    title: form.title.trim(),
    desc: form.desc.trim(),
    tech: form.techText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    tags: form.tagsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6),
    repo: form.repo.trim(),
    demo: form.demo.trim(),
    gradient: form.gradient,
    icon: form.icon,
    featured: form.featured,
  });
}
</script>

<template>
  <div class="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4" @click.self="emit('cancel')">
    <div
      class="modal-surface mx-auto my-6 w-full max-w-2xl rounded-3xl p-6 shadow-2xl md:p-8"
      role="dialog"
      aria-label="编辑项目"
    >
      <div class="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/60">
        <h2 class="flex items-center gap-2 text-lg font-bold">
          <AppIcon :name="project ? 'pen' : 'plus'" class="size-5 text-cyan-600 dark:text-cyan-400" />
          {{ project ? '编辑项目' : '新增项目' }}
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
          <label class="mb-1.5 block text-sm font-medium">项目名称 *</label>
          <input
            v-model="form.title"
            type="text"
            maxlength="60"
            placeholder="项目名称"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium">项目描述</label>
          <textarea
            v-model="form.desc"
            rows="3"
            maxlength="300"
            placeholder="一句话介绍项目"
            class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
          />
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium">技术栈（逗号分隔）</label>
            <input
              v-model="form.techText"
              type="text"
              placeholder="Vue 3, TypeScript"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">标签（逗号分隔）</label>
            <input
              v-model="form.tagsText"
              type="text"
              placeholder="全栈, 开源"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium">仓库链接</label>
            <input
              v-model="form.repo"
              type="url"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">演示链接</label>
            <input
              v-model="form.demo"
              type="url"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium">封面渐变</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="g in GRADIENTS"
                :key="g"
                type="button"
                class="h-9 w-14 rounded-lg border-2 transition-transform"
                :style="{ background: g, borderColor: form.gradient === g ? '#0891b2' : 'transparent' }"
                :aria-label="`封面渐变 ${GRADIENTS.indexOf(g) + 1}`"
                @click="form.gradient = g"
              />
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">图标</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="ic in ICONS"
                :key="ic"
                type="button"
                class="grid size-9 place-items-center rounded-lg border transition-colors"
                :class="form.icon === ic ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'"
                :aria-label="`图标 ${ic}`"
                @click="form.icon = ic"
              >
                <AppIcon :name="ic" class="size-4" />
              </button>
            </div>
          </div>
        </div>

        <label class="flex cursor-pointer items-center gap-3 text-sm">
          <input v-model="form.featured" type="checkbox" class="size-4 accent-cyan-500" />
          <span>设为精选项目（显示在首页）</span>
        </label>
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
