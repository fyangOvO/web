/**
 * useFontLoader — 字體加載器。
 * 根據 siteFont 字符串動態注入 Google Fonts <link>，並用 CSS 變量覆蓋全站字體。
 * 首次加載後緩存 link 標籤，避免重複請求。
 */
import { watch } from 'vue';
import { useSettings } from './useSettings';

/** 字體設置表：key → 顯示名稱 + CSS 用的 font-family 字符串 + Google Fonts 名（URL encode 用） */
export interface FontEntry {
  key: string;
  label: string;
  /** 最終寫到 --site-font-family 的值（多個 fallback） */
  family: string;
  /** Google Fonts 的 family 名，用於組 URL；空代表純系統字體 */
  googleName: string;
  /** Google Fonts 字重參數，如 `wght@400`；留空使用默認 `ital,wght@0,400;0,500;0,600;0,700;1,400` */
  weights?: string;
}

export const FONT_PRESETS: FontEntry[] = [
  // === 藝術中文（書法 / 手寫 / 特色）===
  {
    key: 'ma-shan-zheng',
    label: '馬善政毛筆楷書',
    family: '"Ma Shan Zheng", "KaiTi", "STKaiti", "BiauKai", cursive',
    googleName: 'Ma Shan Zheng',
    weights: 'wght@400',
  },
  {
    key: 'long-cang',
    label: '龍蒼毛筆體',
    family: '"Long Cang", "KaiTi", "STKaiti", "BiauKai", cursive',
    googleName: 'Long Cang',
    weights: 'wght@400',
  },
  {
    key: 'zhi-mang-xing',
    label: '志莽行書',
    family: '"Zhi Mang Xing", "KaiTi", "STKaiti", "BiauKai", cursive',
    googleName: 'Zhi Mang Xing',
    weights: 'wght@400',
  },
  {
    key: 'liu-jian-mao-cao',
    label: '柳公權草書',
    family: '"Liu Jian Mao Cao", "KaiTi", "STKaiti", "BiauKai", cursive',
    googleName: 'Liu Jian Mao Cao',
    weights: 'wght@400',
  },
  {
    key: 'zcool-xiaowei',
    label: '站酷小薇體',
    family: '"ZCOOL XiaoWei", "PingFang SC", "Microsoft YaHei", sans-serif',
    googleName: 'ZCOOL XiaoWei',
    weights: 'wght@400',
  },
  {
    key: 'zcool-qingke-huangyou',
    label: '站酷慶科黃油體',
    family: '"ZCOOL QingKe HuangYou", "PingFang SC", "Microsoft YaHei", sans-serif',
    googleName: 'ZCOOL QingKe HuangYou',
    weights: 'wght@400',
  },
  // === 襯線 / 優雅 ===
  {
    key: 'noto-serif-sc',
    label: '思源宋體（優雅襯線）',
    family: '"Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif',
    googleName: 'Noto Serif SC',
    weights: 'wght@400;500;600;700',
  },
  {
    key: 'lora',
    label: 'Lora（襯線）',
    family: '"Lora", "Noto Serif SC", serif',
    googleName: 'Lora',
  },
  {
    key: 'playfair-display',
    label: 'Playfair Display（優雅）',
    family: '"Playfair Display", "Noto Serif SC", serif',
    googleName: 'Playfair Display',
  },
  // === 現代無襯線 ===
  {
    key: 'default',
    label: '預設（Inter + 系統中文字體）',
    family: '"Inter", "PingFang SC", "HarmonyOS Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    googleName: 'Inter',
  },
  {
    key: 'system-ui',
    label: '系統預設',
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    googleName: '',
  },
  {
    key: 'noto-sans-sc',
    label: 'Noto Sans SC（思源黑體）',
    family: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    googleName: 'Noto Sans SC',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    family: '"Roboto", "PingFang SC", sans-serif',
    googleName: 'Roboto',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    family: '"Poppins", "PingFang SC", sans-serif',
    googleName: 'Poppins',
  },
  {
    key: 'quicksand',
    label: 'Quicksand',
    family: '"Quicksand", "PingFang SC", sans-serif',
    googleName: 'Quicksand',
  },
  {
    key: 'nunito',
    label: 'Nunito',
    family: '"Nunito", "PingFang SC", sans-serif',
    googleName: 'Nunito',
  },
  {
    key: 'open-sans',
    label: 'Open Sans',
    family: '"Open Sans", "PingFang SC", sans-serif',
    googleName: 'Open Sans',
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    family: '"Montserrat", "PingFang SC", sans-serif',
    googleName: 'Montserrat',
  },
  {
    key: 'source-sans-3',
    label: 'Source Sans 3',
    family: '"Source Sans 3", "PingFang SC", sans-serif',
    googleName: 'Source Sans 3',
  },
  // === 等寬 / 特殊 ===
  {
    key: 'jetbrains-mono',
    label: 'JetBrains Mono（等寬）',
    family: '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace',
    googleName: 'JetBrains Mono',
  },
];

/** 查找 font entry */
export function findFont(key: string): FontEntry {
  return FONT_PRESETS.find((f) => f.key === key) || FONT_PRESETS[0];
}

/** 已注入的 Google Font 名集合（避免重複） */
const loadedGoogleFonts = new Set<string>();

/** 異步加載一個 Google Font（通過 link 標籤） */
function loadGoogleFont(familyName: string, weights?: string): Promise<void> {
  if (!familyName) return Promise.resolve();
  if (loadedGoogleFonts.has(familyName)) return Promise.resolve();

  return new Promise((resolve) => {
    const weightsParam = weights || 'ital,wght@0,400;0,500;0,600;0,700;1,400';
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:${weightsParam}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => {
      loadedGoogleFonts.add(familyName);
      resolve();
    };
    link.onerror = () => resolve(); // 失敗也不阻塞
    document.head.appendChild(link);
  });
}

/** 將給定 font 的 family 寫到 :root CSS 變量 */
function applyFontToDOM(entry: FontEntry) {
  document.documentElement.style.setProperty('--site-font-family', entry.family);
}

/** 啟動：讀取 settings.siteFont → 加載 → 應用；之後 watch 變化實時切換 */
export function useFontLoader() {
  const { siteFont, loaded } = useSettings();

  async function applyNow(key: string) {
    const entry = findFont(key);
    if (entry.googleName) {
      await loadGoogleFont(entry.googleName, entry.weights);
    }
    applyFontToDOM(entry);
  }

  // 等 settings 從後端加載完後立即應用一次
  const stop = watch(
    () => loaded.value,
    (val) => {
      if (val) {
        applyNow(siteFont.value);
        stop();
      }
    },
    { immediate: true },
  );

  // 之後 siteFont 變化時實時切換
  watch(siteFont, (val) => {
    applyNow(val);
  });

  return { applyNow };
}
