import type { Directive } from 'vue';

/**
 * v-reveal 指令：元素进入视口时播放渐入动画。
 * 用法：<div v-reveal> ... </div>
 */
export const reveal: Directive<HTMLElement> = {
  mounted(el, binding) {
    // 数字参数可控制延迟（秒）
    const delay = typeof binding.value === 'number' ? binding.value : 0;
    el.classList.add('reveal');
    if (delay > 0) {
      el.style.transitionDelay = `${delay}s`;
    }
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('reveal-visible');
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
  },
};
