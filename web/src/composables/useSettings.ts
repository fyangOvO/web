import { ref } from 'vue';
import { getSettings, adminUpdateSettings, type SiteSettings, type AlbumLayout } from '../api';

/** 相冊版面配置默認值（與後端 DEFAULT_ALBUM_LAYOUT 保持一致） */
export const DEFAULT_ALBUM_LAYOUT: AlbumLayout = {
  wall: { layout: 'tilt', columns: 'auto', size: 'md', tilt: 4, showCount: true, showDesc: true },
  photos: { layout: 'masonry', columns: 'auto', gap: 'md', ratio: 'original', rounded: true },
};

// 模块级单例状态（所有组件共享同一份）
const fancyButtons = ref(false);
const showCarousel = ref(true);
const carouselPaginate = ref(true);
const carouselInterval = ref(5000);
const clickEffectEnabled = ref(true);
const clickEffect = ref<SiteSettings['clickEffect']>('hearts');
const customClickImage = ref('');
const clickEffectSize = ref(1);
const clickEffectGlow = ref<SiteSettings['clickEffectGlow']>('soft');
const clickEffectGlowIntensity = ref(60);
const clickEffectMulticolor = ref(true);
const musicEnabled = ref(true);
const musicSkin = ref<SiteSettings['musicSkin']>('default');
const musicSkinBg = ref('');
const musicSkinOpacity = ref(85);
const musicSkinBlur = ref(12);
const backgroundType = ref('aurora');
// 看板娘
const companionEnabled = ref(true);
const companionSkin = ref<SiteSettings['companionSkin']>('default');
const companionIdleAnim = ref<SiteSettings['companionIdleAnim']>('bob');
const companionIdleAnimImage = ref('');
const companionCustomImage = ref('');
const companionSays = ref<string[]>([]);
const siteFont = ref('default');
const siteLanguage = ref<'zh-Hant' | 'zh-Hans' | 'en'>('zh-Hant');
const navItems = ref<{ to: string; label: string; icon?: string; hidden?: boolean }[]>([]);
// 相冊版面配置（相冊牆 + 相冊內照片）
const albumLayout = ref<AlbumLayout>({
  wall: { ...DEFAULT_ALBUM_LAYOUT.wall },
  photos: { ...DEFAULT_ALBUM_LAYOUT.photos },
});
const loaded = ref(false);

async function fetchSettings() {
  try {
    const data = await getSettings();
    fancyButtons.value = data.fancyButtons;
    showCarousel.value = data.showCarousel;
    carouselPaginate.value = data.carouselPaginate ?? true;
    carouselInterval.value = data.carouselInterval ?? 5000;
    clickEffectEnabled.value = data.clickEffectEnabled !== false;
    clickEffect.value = data.clickEffect || 'hearts';
    customClickImage.value = data.customClickImage || '';
    clickEffectSize.value = typeof data.clickEffectSize === 'number' ? data.clickEffectSize : 1;
    clickEffectGlow.value = data.clickEffectGlow || 'soft';
    clickEffectGlowIntensity.value =
      typeof data.clickEffectGlowIntensity === 'number' ? data.clickEffectGlowIntensity : 60;
    clickEffectMulticolor.value = data.clickEffectMulticolor !== false;
    musicEnabled.value = data.musicEnabled ?? true;
    musicSkin.value = data.musicSkin || 'default';
    musicSkinBg.value = data.musicSkinBg || '';
    musicSkinOpacity.value = typeof data.musicSkinOpacity === 'number' ? data.musicSkinOpacity : 85;
    musicSkinBlur.value = typeof data.musicSkinBlur === 'number' ? data.musicSkinBlur : 12;
    backgroundType.value = data.backgroundType || 'aurora';
    companionEnabled.value = data.companionEnabled !== false;
    companionSkin.value = data.companionSkin || 'default';
    companionIdleAnim.value = data.companionIdleAnim || 'bob';
    companionIdleAnimImage.value = data.companionIdleAnimImage || '';
    companionCustomImage.value = data.companionCustomImage || '';
    companionSays.value = Array.isArray(data.companionSays) ? data.companionSays : [];
    siteFont.value = data.siteFont || 'default';
    siteLanguage.value = ['zh-Hant', 'zh-Hans', 'en'].includes(data.siteLanguage) ? data.siteLanguage : 'zh-Hant';
    navItems.value = Array.isArray(data.navItems) ? data.navItems : [];
    if (data.albumLayout) {
      albumLayout.value = {
        wall: { ...DEFAULT_ALBUM_LAYOUT.wall, ...data.albumLayout.wall },
        photos: { ...DEFAULT_ALBUM_LAYOUT.photos, ...data.albumLayout.photos },
      };
    }
  } catch {
    /* 默认值 */
  } finally {
    loaded.value = true;
  }
}

async function updateSettings(payload: Partial<SiteSettings>) {
  await adminUpdateSettings(payload);
  if (typeof payload.fancyButtons === 'boolean') fancyButtons.value = payload.fancyButtons;
  if (typeof payload.showCarousel === 'boolean') showCarousel.value = payload.showCarousel;
  if (typeof payload.carouselPaginate === 'boolean') carouselPaginate.value = payload.carouselPaginate;
  if (typeof payload.carouselInterval === 'number') carouselInterval.value = payload.carouselInterval;
  if (typeof payload.clickEffectEnabled === 'boolean') clickEffectEnabled.value = payload.clickEffectEnabled;
  if (payload.clickEffect) clickEffect.value = payload.clickEffect;
  if (typeof payload.customClickImage === 'string') customClickImage.value = payload.customClickImage;
  if (typeof payload.clickEffectSize === 'number') clickEffectSize.value = payload.clickEffectSize;
  if (payload.clickEffectGlow) clickEffectGlow.value = payload.clickEffectGlow;
  if (typeof payload.clickEffectGlowIntensity === 'number') {
    clickEffectGlowIntensity.value = payload.clickEffectGlowIntensity;
  }
  if (typeof payload.clickEffectMulticolor === 'boolean') {
    clickEffectMulticolor.value = payload.clickEffectMulticolor;
  }
  if (typeof payload.musicEnabled === 'boolean') musicEnabled.value = payload.musicEnabled;
  if (payload.musicSkin) musicSkin.value = payload.musicSkin;
  if (typeof payload.musicSkinBg === 'string') musicSkinBg.value = payload.musicSkinBg;
  if (typeof payload.musicSkinOpacity === 'number') musicSkinOpacity.value = payload.musicSkinOpacity;
  if (typeof payload.musicSkinBlur === 'number') musicSkinBlur.value = payload.musicSkinBlur;
  if (payload.backgroundType) backgroundType.value = payload.backgroundType;
  if (typeof payload.companionEnabled === 'boolean') companionEnabled.value = payload.companionEnabled;
  if (payload.companionSkin) companionSkin.value = payload.companionSkin;
  if (payload.companionIdleAnim) companionIdleAnim.value = payload.companionIdleAnim;
  if (typeof payload.companionIdleAnimImage === 'string') companionIdleAnimImage.value = payload.companionIdleAnimImage;
  if (typeof payload.companionCustomImage === 'string') companionCustomImage.value = payload.companionCustomImage;
  if (Array.isArray(payload.companionSays)) companionSays.value = payload.companionSays;
  if (typeof payload.siteFont === 'string') siteFont.value = payload.siteFont;
  if (payload.siteLanguage === 'zh-Hant' || payload.siteLanguage === 'zh-Hans' || payload.siteLanguage === 'en') {
    siteLanguage.value = payload.siteLanguage;
  }
  if (Array.isArray(payload.navItems)) navItems.value = payload.navItems;
  if (payload.albumLayout) {
    albumLayout.value = {
      wall: { ...DEFAULT_ALBUM_LAYOUT.wall, ...payload.albumLayout.wall },
      photos: { ...DEFAULT_ALBUM_LAYOUT.photos, ...payload.albumLayout.photos },
    };
  }
}

export function useSettings() {
  if (!loaded.value) fetchSettings();
  return {
    fancyButtons,
    showCarousel,
    carouselPaginate,
    carouselInterval,
    clickEffectEnabled,
    clickEffect,
    customClickImage,
    clickEffectSize,
    clickEffectGlow,
    clickEffectGlowIntensity,
    clickEffectMulticolor,
    musicEnabled,
    musicSkin,
    musicSkinBg,
    musicSkinOpacity,
    musicSkinBlur,
    backgroundType,
    companionEnabled,
    companionSkin,
    companionIdleAnim,
    companionIdleAnimImage,
    companionCustomImage,
    companionSays,
    siteFont,
    siteLanguage,
    navItems,
    albumLayout,
    loaded,
    fetchSettings,
    updateSettings,
  };
}
