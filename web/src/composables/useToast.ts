import { reactive } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

const state = reactive<{ items: ToastItem[] }>({ items: [] });
let nextId = 1;

function push(type: ToastType, message: string, duration = 2600) {
  const id = nextId++;
  state.items.push({ id, type, message, duration });
  window.setTimeout(() => remove(id), duration);
}

function remove(id: number) {
  const idx = state.items.findIndex((t) => t.id === id);
  if (idx >= 0) state.items.splice(idx, 1);
}

export function useToast() {
  return {
    items: state.items,
    show: (msg: string, type: ToastType = 'info', duration?: number) => push(type, msg, duration),
    success: (msg: string, duration?: number) => push('success', msg, duration),
    error: (msg: string, duration?: number) => push('error', msg, duration),
    warning: (msg: string, duration?: number) => push('warning', msg, duration),
    info: (msg: string, duration?: number) => push('info', msg, duration),
    dismiss: remove,
  };
}

// 方便在非组件里直接用
export const toast = {
  show: (msg: string, type: ToastType = 'info', duration?: number) => push(type, msg, duration),
  success: (msg: string, duration?: number) => push('success', msg, duration),
  error: (msg: string, duration?: number) => push('error', msg, duration),
  warning: (msg: string, duration?: number) => push('warning', msg, duration),
  info: (msg: string, duration?: number) => push('info', msg, duration),
};
