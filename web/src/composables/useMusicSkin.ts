/**
 * 音乐播放器皮肤定义表
 *
 * 设计意图：把所有皮肤的外观参数集中在这里，后台「皮肤选择器」与前台
 * 「播放器面板」共用同一份定义，避免样式散落在两个组件里对不上。
 *
 * 每个皮肤提供：
 * - key / label / desc：标识与展示名
 * - light / dark：两套配色（面板背景、边框、主文字、次要文字、分隔线）
 * - headerBg：标题栏背景
 * - preview：后台缩略图预览用的简短 CSS（背景 + 文字色示意）
 * - isImage：是否为「上传图片」型皮肤
 *
 * 面板背景用 rgba 字符串，便于叠加图片皮肤的透明度调节。
 */

export interface SkinPalette {
  /** 面板背景（rgba） */
  panel: string;
  /** 边框色 */
  border: string;
  /** 主文字色 */
  text: string;
  /** 次要文字色 */
  muted: string;
  /** 分隔线色 */
  divider: string;
  /** 输入框背景 */
  input: string;
  /** 悬停高亮背景 */
  hover: string;
}

export interface MusicSkin {
  key: string;
  label: string;
  desc: string;
  /** 标题栏背景（CSS background 值） */
  headerBg: string;
  light: SkinPalette;
  dark: SkinPalette;
  /** 后台预览缩略图样式 */
  preview: Record<string, string>;
  /** 是否为上传图片型皮肤 */
  isImage?: boolean;
}

/** 跟随主题色的面板（用 CSS 变量，随主题切换而动） */
const THEME_PANEL = 'rgba(255, 255, 255, 0.8)';
const THEME_PANEL_DARK = 'rgba(15, 23, 42, 0.8)';

export const MUSIC_SKINS: MusicSkin[] = [
  {
    key: 'default',
    label: '跟随主题',
    desc: '毛玻璃质感，随站点主题色变化',
    headerBg: 'linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.18), rgba(var(--accent-2-rgb), 0.18))',
    light: {
      panel: THEME_PANEL, border: 'rgba(255, 255, 255, 0.35)',
      text: '#1e293b', muted: '#64748b', divider: 'rgba(15, 23, 42, 0.08)',
      input: 'rgba(248, 250, 252, 0.85)', hover: 'rgba(255, 255, 255, 0.72)',
    },
    dark: {
      panel: THEME_PANEL_DARK, border: 'rgba(255, 255, 255, 0.1)',
      text: '#e2e8f0', muted: '#94a3b8', divider: 'rgba(148, 163, 184, 0.18)',
      input: 'rgba(30, 41, 59, 0.8)', hover: 'rgba(30, 41, 59, 0.72)',
    },
    preview: { background: 'linear-gradient(135deg, #06b6d4, #2563eb)' },
  },
  {
    key: 'glass',
    label: '通透玻璃',
    desc: '高透明度，背景内容若隐若现',
    headerBg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.1))',
    light: {
      panel: 'rgba(255, 255, 255, 0.52)', border: 'rgba(255, 255, 255, 0.6)',
      text: '#0f172a', muted: '#475569', divider: 'rgba(15, 23, 42, 0.1)',
      input: 'rgba(255, 255, 255, 0.62)', hover: 'rgba(255, 255, 255, 0.55)',
    },
    dark: {
      panel: 'rgba(15, 23, 42, 0.5)', border: 'rgba(255, 255, 255, 0.16)',
      text: '#f1f5f9', muted: '#94a3b8', divider: 'rgba(148, 163, 184, 0.2)',
      input: 'rgba(15, 23, 42, 0.55)', hover: 'rgba(51, 65, 85, 0.5)',
    },
    preview: { background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.75)' },
  },
  {
    key: 'frosted',
    label: '磨砂白',
    desc: '不透明奶白，最清晰易读',
    headerBg: 'linear-gradient(135deg, rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.9))',
    light: {
      panel: 'rgba(252, 252, 253, 0.96)', border: 'rgba(15, 23, 42, 0.08)',
      text: '#0f172a', muted: '#64748b', divider: 'rgba(15, 23, 42, 0.08)',
      input: '#ffffff', hover: 'rgba(241, 245, 249, 0.95)',
    },
    dark: {
      panel: 'rgba(241, 245, 249, 0.94)', border: 'rgba(15, 23, 42, 0.12)',
      text: '#0f172a', muted: '#475569', divider: 'rgba(15, 23, 42, 0.1)',
      input: '#ffffff', hover: 'rgba(226, 232, 240, 0.9)',
    },
    preview: { background: '#fcfcfd', border: '1px solid #e2e8f0' },
  },
  {
    key: 'light',
    label: '浅色纸感',
    desc: '经典浅色面板，纯白实底',
    headerBg: 'linear-gradient(135deg, rgba(var(--accent-1-rgb), 0.14), rgba(var(--accent-2-rgb), 0.1))',
    light: {
      panel: 'rgba(255, 255, 255, 0.94)', border: 'rgba(15, 23, 42, 0.08)',
      text: '#1e293b', muted: '#64748b', divider: 'rgba(15, 23, 42, 0.08)',
      input: 'rgba(248, 250, 252, 0.9)', hover: 'rgba(241, 245, 249, 0.9)',
    },
    dark: {
      panel: 'rgba(255, 255, 255, 0.92)', border: 'rgba(15, 23, 42, 0.12)',
      text: '#1e293b', muted: '#64748b', divider: 'rgba(15, 23, 42, 0.1)',
      input: 'rgba(248, 250, 252, 0.95)', hover: 'rgba(241, 245, 249, 0.9)',
    },
    preview: { background: '#ffffff', border: '1px solid #e2e8f0' },
  },
  {
    key: 'midnight',
    label: '暗夜蓝紫',
    desc: '深蓝紫实底，护眼沉稳',
    headerBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(168, 85, 247, 0.35))',
    light: {
      panel: 'rgba(30, 27, 75, 0.95)', border: 'rgba(148, 163, 184, 0.22)',
      text: '#e0e7ff', muted: '#a5b4fc', divider: 'rgba(148, 163, 184, 0.2)',
      input: 'rgba(49, 46, 129, 0.6)', hover: 'rgba(99, 102, 241, 0.28)',
    },
    dark: {
      panel: 'rgba(23, 21, 55, 0.94)', border: 'rgba(148, 163, 184, 0.2)',
      text: '#e0e7ff', muted: '#a5b4fc', divider: 'rgba(148, 163, 184, 0.18)',
      input: 'rgba(49, 46, 129, 0.5)', hover: 'rgba(99, 102, 241, 0.25)',
    },
    preview: { background: '#1e1b4b' },
  },
  {
    key: 'dark',
    label: '深色午夜',
    desc: '中性深色，任何页面都压得住',
    headerBg: 'linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(30, 41, 59, 0.8))',
    light: {
      panel: 'rgba(15, 23, 42, 0.94)', border: 'rgba(148, 163, 184, 0.2)',
      text: '#e2e8f0', muted: '#94a3b8', divider: 'rgba(148, 163, 184, 0.18)',
      input: 'rgba(30, 41, 59, 0.85)', hover: 'rgba(51, 65, 85, 0.7)',
    },
    dark: {
      panel: 'rgba(15, 23, 42, 0.92)', border: 'rgba(148, 163, 184, 0.18)',
      text: '#e2e8f0', muted: '#94a3b8', divider: 'rgba(148, 163, 184, 0.16)',
      input: 'rgba(30, 41, 59, 0.8)', hover: 'rgba(51, 65, 85, 0.65)',
    },
    preview: { background: '#0f172a' },
  },
  {
    key: 'sunset',
    label: '暖阳渐变',
    desc: '橙粉暖调，活泼有温度',
    headerBg: 'linear-gradient(135deg, rgba(251, 146, 60, 0.5), rgba(244, 114, 182, 0.4))',
    light: {
      panel: 'rgba(255, 247, 237, 0.95)', border: 'rgba(251, 146, 60, 0.28)',
      text: '#7c2d12', muted: '#c2410c', divider: 'rgba(251, 146, 60, 0.22)',
      input: 'rgba(255, 255, 255, 0.75)', hover: 'rgba(254, 215, 170, 0.5)',
    },
    dark: {
      panel: 'rgba(67, 20, 7, 0.93)', border: 'rgba(251, 146, 60, 0.3)',
      text: '#fed7aa', muted: '#fdba74', divider: 'rgba(251, 146, 60, 0.25)',
      input: 'rgba(124, 45, 18, 0.5)', hover: 'rgba(154, 52, 18, 0.5)',
    },
    preview: { background: 'linear-gradient(135deg, #fb923c, #f472b6)' },
  },
  {
    key: 'neon',
    label: '霓虹暗色',
    desc: '深底霓虹描边，科技感强',
    headerBg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.35), rgba(217, 70, 239, 0.3))',
    light: {
      panel: 'rgba(10, 10, 20, 0.95)', border: 'rgba(6, 182, 212, 0.55)',
      text: '#a5f3fc', muted: '#67e8f9', divider: 'rgba(6, 182, 212, 0.3)',
      input: 'rgba(6, 182, 212, 0.1)', hover: 'rgba(6, 182, 212, 0.18)',
    },
    dark: {
      panel: 'rgba(10, 10, 20, 0.94)', border: 'rgba(6, 182, 212, 0.5)',
      text: '#a5f3fc', muted: '#67e8f9', divider: 'rgba(6, 182, 212, 0.26)',
      input: 'rgba(6, 182, 212, 0.1)', hover: 'rgba(6, 182, 212, 0.16)',
    },
    preview: { background: '#0a0a14', border: '1px solid #06b6d4' },
  },
  {
    key: 'paper',
    label: '米白素纸',
    desc: '暖米色调，安静克制',
    headerBg: 'linear-gradient(135deg, rgba(217, 199, 170, 0.5), rgba(199, 178, 145, 0.4))',
    light: {
      panel: 'rgba(253, 251, 245, 0.96)', border: 'rgba(180, 160, 130, 0.3)',
      text: '#3f3628', muted: '#857357', divider: 'rgba(180, 160, 130, 0.25)',
      input: 'rgba(255, 255, 255, 0.8)', hover: 'rgba(240, 233, 219, 0.7)',
    },
    dark: {
      panel: 'rgba(45, 40, 32, 0.94)', border: 'rgba(180, 160, 130, 0.28)',
      text: '#ede4d3', muted: '#c4b299', divider: 'rgba(180, 160, 130, 0.22)',
      input: 'rgba(62, 55, 44, 0.7)', hover: 'rgba(85, 75, 58, 0.6)',
    },
    preview: { background: '#fdfbf5', border: '1px solid #d9c7aa' },
  },
  {
    key: 'custom',
    label: '自定义图片',
    desc: '上传一张图片作为面板背景',
    headerBg: 'linear-gradient(135deg, rgba(15, 23, 42, 0.55), rgba(15, 23, 42, 0.35))',
    light: {
      panel: 'rgba(255, 255, 255, 0.85)', border: 'rgba(255, 255, 255, 0.45)',
      text: '#0f172a', muted: '#475569', divider: 'rgba(255, 255, 255, 0.4)',
      input: 'rgba(255, 255, 255, 0.72)', hover: 'rgba(255, 255, 255, 0.55)',
    },
    dark: {
      panel: 'rgba(15, 23, 42, 0.8)', border: 'rgba(255, 255, 255, 0.2)',
      text: '#f8fafc', muted: '#cbd5e1', divider: 'rgba(255, 255, 255, 0.22)',
      input: 'rgba(15, 23, 42, 0.6)', hover: 'rgba(255, 255, 255, 0.14)',
    },
    preview: { background: 'linear-gradient(135deg, #94a3b8, #64748b)' },
    isImage: true,
  },
];

/** 按 key 取皮肤，未命中回退到 default */
export function getSkin(key: string | undefined): MusicSkin {
  return MUSIC_SKINS.find((s) => s.key === key) || MUSIC_SKINS[0];
}

/** 生成面板样式（含自定义图片皮肤的透明度/模糊叠加） */
export function buildPanelStyle(opts: {
  skin: MusicSkin;
  isDark: boolean;
  bgImage?: string;
  opacity?: number; // 0~100
  blur?: number;    // 0~40
}): Record<string, string> {
  const { skin, isDark, bgImage, opacity = 85, blur = 12 } = opts;
  const pal = isDark ? skin.dark : skin.light;
  const style: Record<string, string> = {
    borderColor: pal.border,
    color: pal.text,
    backdropFilter: `blur(${blur}px) saturate(130%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(130%)`,
  };

  if (skin.isImage && bgImage) {
    // 图片皮肤：图片铺底 + 半透明蒙层保证文字对比度
    const a = Math.max(0, Math.min(1, opacity / 100));
    const overlay = isDark ? `rgba(15, 23, 42, ${a})` : `rgba(255, 255, 255, ${a})`;
    style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url(${bgImage})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
  } else {
    style.backgroundColor = pal.panel;
  }
  return style;
}
