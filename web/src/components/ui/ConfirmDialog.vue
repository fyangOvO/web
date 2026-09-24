<script setup lang="ts">
import { useConfirm } from '../../composables/useConfirm';
import AppIcon from './AppIcon.vue';

const { state, confirm, cancel } = useConfirm();

function onKeydown(e: KeyboardEvent) {
  if (!state.visible) return;
  if (e.key === 'Escape') cancel();
  if (e.key === 'Enter') confirm();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.visible"
        class="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        @keydown="onKeydown"
      >
        <!-- 遮罩 -->
        <div class="modal-backdrop absolute inset-0" @click="cancel" />

        <!-- 弹窗 -->
        <div
          class="modal-surface relative w-full max-w-sm overflow-hidden rounded-2xl p-6"
          role="alertdialog"
          aria-modal="true"
        >
          <Transition name="scale" appear>
            <!-- 顶部装饰条 -->
            <div
              class="absolute inset-x-0 top-0 h-1"
              :class="state.danger ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-sky-400 to-indigo-500'"
            />
          </Transition>

          <!-- 图标 + 标题 -->
          <div class="mb-4 flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :class="state.danger
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                : 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400'"
            >
              <AppIcon :name="state.danger ? 'trash' : 'alert-circle'" class="size-5" />
            </div>
            <div class="flex-1 pt-0.5">
              <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ state.title }}</h3>
              <p class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ state.message }}</p>
            </div>
          </div>

          <!-- 按钮 -->
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="btn-ghost !px-4 !py-2 text-sm"
              @click="cancel"
            >
              <AppIcon name="close" class="size-4" />
              {{ state.cancelText }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow transition-all hover:shadow-md active:scale-[0.98]"
              :class="state.danger
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700'
                : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600'"
              @click="confirm"
            >
              <AppIcon :name="state.danger ? 'trash' : 'check'" class="size-4" />
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active > div:last-child,
.fade-leave-active > div:last-child {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 0), opacity 0.25s ease;
}
.fade-enter-from > div:last-child,
.fade-leave-to > div:last-child {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
