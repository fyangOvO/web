/**
 * 看板娘造型定义表
 *
 * 设计意图：与 useMusicSkin.ts 保持同一范式 —— 后台「造型选择器」与前台
 * 「看板娘本体」共用同一份定义，避免配色散落在两个组件里对不上。
 *
 * 每个造型提供：
 * - key / label / desc：标识与展示名（后台用）
 * - 三层身体配色 hair / hairShade / hairHi：发色主体 / 暗部 / 高光
 * - 皮肤色 skin / skinShade：脸部与四肢
 * - 耳内色 earInner、眼睛色 eye、腮红色 blush
 * - 服装色 dress / dressHi
 * - preview：后台缩略图预览（背景 + 耳朵示意色）
 *
 * 所有配色都用具体色值而非主题变量，除了 default（跟随主题）。
 */

export interface CompanionSkin {
  key: string;
  label: string;
  desc: string;
  /** 跟随主题色（仅 default） */
  followsTheme?: boolean;
  /** 发色主体 */
  hair: string;
  /** 发色暗部（刘海下沿 / 内侧） */
  hairShade: string;
  /** 发色高光（顶部弧形亮带） */
  hairHi: string;
  /** 皮肤主体 */
  skin: string;
  /** 皮肤暗部（下巴 / 手臂内侧） */
  skinShade: string;
  /** 耳内色 */
  earInner: string;
  /** 眼瞳色 */
  eye: string;
  /** 腮红色 */
  blush: string;
  /** 衣服主体 */
  dress: string;
  /** 衣服亮部 / 领口 */
  dressHi: string;
  /** 后台预览缩略图样式 */
  preview: Record<string, string>;
}

export const COMPANION_SKINS: CompanionSkin[] = [
  {
    key: 'default',
    label: '少女',
    desc: '跟随站点主题色，圆润柔和的少女形象',
    followsTheme: true,
    hair: 'var(--accent-1)',
    hairShade: 'var(--accent-2)',
    hairHi: 'rgba(255, 255, 255, 0.55)',
    skin: '#FFE3D0',
    skinShade: '#F5C9AE',
    earInner: '#FFB3C1',
    eye: '#3B2A3D',
    blush: '#FF9DAE',
    dress: 'var(--accent-2)',
    dressHi: 'rgba(255, 255, 255, 0.35)',
    preview: { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' },
  },
  {
    key: 'cat',
    label: '猫娘',
    desc: '棕色猫耳 + 粉鼻，元气满点',
    hair: '#8C5A3C',
    hairShade: '#6B4423',
    hairHi: 'rgba(255, 224, 189, 0.5)',
    skin: '#FFE6D2',
    skinShade: '#F7CDB2',
    earInner: '#FFB0BE',
    eye: '#4A3520',
    blush: '#FF9BAE',
    dress: '#F5A65B',
    dressHi: 'rgba(255, 255, 255, 0.32)',
    preview: { background: 'linear-gradient(135deg, #8C5A3C, #F5A65B)' },
  },
  {
    key: 'bunny',
    label: '兔娘',
    desc: '长耳软白兔，乖巧治愈',
    hair: '#F7E3E8',
    hairShade: '#E4C4CE',
    hairHi: 'rgba(255, 255, 255, 0.8)',
    skin: '#FFF0E4',
    skinShade: '#F6D6C4',
    earInner: '#FFC2CD',
    eye: '#5B4550',
    blush: '#FFA8B8',
    dress: '#9EC5F8',
    dressHi: 'rgba(255, 255, 255, 0.4)',
    preview: { background: 'linear-gradient(135deg, #F7E3E8, #9EC5F8)' },
  },
  {
    key: 'bear',
    label: '小熊',
    desc: '圆耳憨态棕熊，安静陪伴',
    hair: '#A9714A',
    hairShade: '#87552F',
    hairHi: 'rgba(255, 226, 189, 0.45)',
    skin: '#FFE8D5',
    skinShade: '#F4CDAF',
    earInner: '#E8B78F',
    eye: '#3F2E1E',
    blush: '#F49A8A',
    dress: '#C98B5E',
    dressHi: 'rgba(255, 255, 255, 0.3)',
    preview: { background: 'linear-gradient(135deg, #A9714A, #C98B5E)' },
  },
  {
    key: 'panda',
    label: '熊猫',
    desc: '黑白撞色，带一顶小竹叶',
    hair: '#3A3A44',
    hairShade: '#24242C',
    hairHi: 'rgba(255, 255, 255, 0.4)',
    skin: '#FFF4EA',
    skinShade: '#F2DCD0',
    earInner: '#6E6E7A',
    eye: '#1F1F26',
    blush: '#FFB0B0',
    dress: '#7FD1AE',
    dressHi: 'rgba(255, 255, 255, 0.38)',
    preview: { background: 'linear-gradient(135deg, #3A3A44, #7FD1AE)' },
  },
  {
    key: 'fox',
    label: '狐狸',
    desc: '橙红狐耳 + 白尾尖，灵动俏皮',
    hair: '#EF7C3C',
    hairShade: '#C9551F',
    hairHi: 'rgba(255, 231, 199, 0.5)',
    skin: '#FFEAD9',
    skinShade: '#F6CFB4',
    earInner: '#FFF1E0',
    eye: '#4A2A16',
    blush: '#FF9A87',
    dress: '#FFB27A',
    dressHi: 'rgba(255, 255, 255, 0.34)',
    preview: { background: 'linear-gradient(135deg, #EF7C3C, #FFB27A)' },
  },
];

/** 按 key 取造型，未命中回退到 default */
export function getCompanionSkin(key: string | undefined): CompanionSkin {
  return COMPANION_SKINS.find((s) => s.key === key) || COMPANION_SKINS[0];
}

/**
 * 生成造型的 CSS 变量表，供 SVG 内联样式消费。
 * 变量名统一用 --c-* 前缀，避免和站点主题变量撞车。
 */
export function buildCompanionVars(skin: CompanionSkin): Record<string, string> {
  return {
    '--c-hair': skin.hair,
    '--c-hair-shade': skin.hairShade,
    '--c-hair-hi': skin.hairHi,
    '--c-skin': skin.skin,
    '--c-skin-shade': skin.skinShade,
    '--c-ear-inner': skin.earInner,
    '--c-eye': skin.eye,
    '--c-blush': skin.blush,
    '--c-dress': skin.dress,
    '--c-dress-hi': skin.dressHi,
  };
}

/** 造型是否为「内置绘制」（非图片型） */
export function isDrawnSkin(key: string | undefined): boolean {
  return COMPANION_SKINS.some((s) => s.key === key);
}
