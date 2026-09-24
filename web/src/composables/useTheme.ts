import { ref } from 'vue';

export type Theme = 'light' | 'dark' | 'sunset' | 'forest' | 'grape';

export interface ThemeMeta {
  key: Theme;
  label: string;
  /** 是否暗色模式（控制 html.dark class） */
  dark: boolean;
  /** 主色渐变起点 */
  accent1: string;
  /** 主色渐变终点 */
  accent2: string;
  /** 主色 rgb 三元组，用于半透明阴影 */
  accent1Rgb: string;
  /** 次色 rgb 三元组 */
  accent2Rgb: string;
}

export const THEMES: ThemeMeta[] = [
  { key: 'light', label: '白天', dark: false, accent1: '#06b6d4', accent2: '#2563eb', accent1Rgb: '6,182,212', accent2Rgb: '37,99,235' },
  { key: 'dark', label: '黑夜', dark: true, accent1: '#22d3ee', accent2: '#60a5fa', accent1Rgb: '34,211,238', accent2Rgb: '96,165,250' },
  { key: 'sunset', label: '日落', dark: false, accent1: '#fb923c', accent2: '#f43f5e', accent1Rgb: '251,146,60', accent2Rgb: '244,63,94' },
  { key: 'forest', label: '森林', dark: false, accent1: '#10b981', accent2: '#0d9488', accent1Rgb: '16,185,129', accent2Rgb: '13,148,136' },
  { key: 'grape', label: '葡萄', dark: true, accent1: '#a855f7', accent2: '#ec4899', accent1Rgb: '168,85,247', accent2Rgb: '236,72,153' },
];

const theme = ref<Theme>('light');

/** 当前主题是否为暗色（供需要区分深浅配色的组件消费） */
const isDark = ref(false);

function metaOf(t: Theme): ThemeMeta {
  return THEMES.find((m) => m.key === t) ?? THEMES[0];
}

export function useTheme() {
  function apply(next: Theme) {
    const meta = metaOf(next);
    theme.value = next;
    isDark.value = meta.dark;
    const root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.classList.toggle('dark', meta.dark);
    root.style.setProperty('--accent-1', meta.accent1);
    root.style.setProperty('--accent-2', meta.accent2);
    root.style.setProperty('--accent-1-rgb', meta.accent1Rgb);
    root.style.setProperty('--accent-2-rgb', meta.accent2Rgb);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }

  function initTheme() {
    let saved: Theme | null = null;
    try {
      saved = localStorage.getItem('theme') as Theme | null;
    } catch {
      /* ignore */
    }
    // 校验存储值是否合法
    const valid = saved && THEMES.some((m) => m.key === saved) ? saved : null;
    // 默认白天；未设置时跟随系统深浅
    if (valid) {
      apply(valid);
    } else {
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      apply(prefersDark ? 'dark' : 'light');
    }
  }

  function set(next: Theme) {
    apply(next);
  }

  return { theme, isDark, set, initTheme, THEMES, metaOf };
}
