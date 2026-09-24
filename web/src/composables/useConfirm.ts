import { reactive } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  visible: boolean;
  resolve: ((ok: boolean) => void) | null;
}

const state = reactive<ConfirmState>({
  visible: false,
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  resolve: null,
});

function open(options: ConfirmOptions): Promise<boolean> {
  state.title = options.title ?? '提示';
  state.message = options.message;
  state.confirmText = options.confirmText ?? '确定';
  state.cancelText = options.cancelText ?? '取消';
  state.danger = options.danger ?? false;
  state.visible = true;
  return new Promise<boolean>((resolve) => {
    state.resolve = (ok: boolean) => {
      state.visible = false;
      resolve(ok);
    };
  });
}

function confirm() {
  state.resolve?.(true);
  state.resolve = null;
}

function cancel() {
  state.resolve?.(false);
  state.resolve = null;
}

export function useConfirm() {
  return {
    state,
    /** Promise 化的确认框，await 拿到 true/false */
    show: open,
    confirm,
    cancel,
  };
}

// 方便在非组件里直接用
export function confirmNow(options: ConfirmOptions): Promise<boolean> {
  return open(options);
}
