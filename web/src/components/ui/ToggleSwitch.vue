<script setup lang="ts">
/**
 * ToggleSwitch —— 统一样式的开关按钮
 *
 * 滑块定位说明：不使用 `absolute` + `translate`（父元素为 button，浏览器默认
 * text-align:center 会让绝对定位元素以中心为静态基准，导致 translate 位移翻倍、
 * 滑块被 overflow-hidden 裁掉）。改为 flex 布局，关闭态靠左、开启态靠右，稳定可控。
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

function onClick() {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :style="modelValue ? { background: 'var(--accent-1)' } : {}"
    :class="modelValue ? '' : 'bg-slate-300 dark:bg-slate-600'"
    @click="onClick"
  >
    <span
      class="h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out"
      :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
