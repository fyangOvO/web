<script setup lang="ts">
/**
 * BendingGallery — 相冊牆。
 * 擺放風格、列數、卡片尺寸、錯落角度皆由後台「版面配置」控制：
 *   grid    —— 整齊網格（等高 4:5）
 *   masonry —— 瀑布流（卡片高度隨封面比例變化）
 *   tilt    —— 錯落貼牆（網格 + 輕微旋轉）
 * 懸停時歸正、抬升並浮現「查看」提示。
 */
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { useI18n } from '../../composables/useI18n';
import { DEFAULT_ALBUM_LAYOUT } from '../../composables/useSettings';
import type { AlbumWallSettings } from '../../api';

interface GalleryItem {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  /** 是否有密碼保護 */
  hasPassword?: boolean;
  /** 該相冊的照片數量 */
  count?: number;
}

const props = withDefaults(
  defineProps<{
    items: GalleryItem[];
    /** 相冊牆版面配置，不傳時使用默認值 */
    layout?: AlbumWallSettings;
  }>(),
  { layout: () => ({ ...DEFAULT_ALBUM_LAYOUT.wall }) },
);

const emit = defineEmits<{
  (e: 'item-click', item: GalleryItem): void;
}>();

const { $t } = useI18n();

const hasItems = computed(() => props.items.length > 0);

/** 卡片基準寬度 */
const SIZE_PX: Record<string, number> = { sm: 168, md: 208, lg: 252 };
const sizePx = computed(() => SIZE_PX[props.layout.size] ?? SIZE_PX.md);

/** auto 列數時的默認值：瀑布流較窄，網格較寬 */
const autoCols = computed(() => (props.layout.layout === 'masonry' ? 3 : 4));

/** 後台指定的列數，或 auto 的默認列數 */
const resolvedCols = computed(() => {
  const c = props.layout.columns;
  return typeof c === 'number' ? Math.max(2, Math.min(6, c)) : autoCols.value;
});

/** 實際生效列數：不超過卡片總數，避免少量卡片被拉散 */
const effCols = computed(() => Math.max(1, Math.min(props.items.length || 1, resolvedCols.value)));

/** 僅「錯落貼牆」且卡片多於 1 張時才旋轉，單張歪著會顯得孤立 */
const canTilt = computed(() => props.layout.layout === 'tilt' && props.items.length > 1);

/** 為每項生成穩定的角度（基於 id 字元，刷新後不變）
 *  幅度取 range 的 45%~95%，避免出現 0° 導致「錯落」看起來沒生效；
 *  方向依 id 與序號交替，相鄰卡片一正一反，視覺上更像刻意貼上去的。 */
function angleOf(id: string, idx: number): number {
  if (!canTilt.value) return 0;
  const range = Math.max(0, Math.min(10, props.layout.tilt));
  if (!range) return 0;
  const sum = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const mag = range * (0.45 + ((sum % 6) / 10));
  const dir = (sum + idx) % 2 === 0 ? 1 : -1;
  return Math.round(dir * mag * 10) / 10;
}

/** 容器寬度依實際列數收斂，讓少量卡片居中而不是被拉滿整行 */
const gridStyle = computed(() => {
  const n = props.items.length;
  if (!n) return undefined;
  const cols = effCols.value;
  const style: Record<string, string> = {
    '--wall-card': `${sizePx.value}px`,
    maxWidth: `calc(${cols} * var(--wall-card) + ${cols - 1} * var(--wall-gap))`,
  };
  // 瀑布流用 column-count 分列
  if (props.layout.layout === 'masonry') style['--wall-mcols'] = String(cols);
  return style;
});

/** 僅在後台指定了具體列數時才輸出 data-cols（auto 交由 auto-fill 自適應） */
const colsAttr = computed(() => (typeof props.layout.columns === 'number' ? props.layout.columns : undefined));

/** 封面載入失敗時降級為純色底，避免出現破圖圖標 */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).classList.add('is-broken');
}
</script>

<template>
  <div class="album-wall">
    <TransitionGroup
      v-if="hasItems"
      tag="div"
      name="gal"
      class="wall-grid"
      :data-layout="layout.layout"
      :data-cols="colsAttr"
      :style="gridStyle"
    >
      <article
        v-for="(item, idx) in items"
        :key="item.id"
        class="wall-card"
        :style="{ '--tilt': `${angleOf(item.id, idx)}deg`, '--i': idx }"
        role="button"
        tabindex="0"
        @click="emit('item-click', item)"
        @keydown.enter.prevent="emit('item-click', item)"
        @keydown.space.prevent="emit('item-click', item)"
      >
        <div class="wall-frame">
          <img
            :src="item.image"
            :alt="item.title"
            loading="lazy"
            class="wall-img"
            @error="onImgError"
          />
          <div class="wall-veil" />

          <span v-if="layout.showCount && item.count" class="wall-chip wall-chip--count">
            <AppIcon name="image" class="size-3" />
            {{ item.count }}
          </span>
          <span
            v-if="item.hasPassword"
            class="wall-chip wall-chip--lock"
            :title="$t('album.categoryNeedsPassword')"
          >
            <AppIcon name="lock" class="size-3" />
          </span>

          <div class="wall-hover">
            <span class="wall-open">
              {{ $t('album.open') }}
              <AppIcon name="arrow-right" class="size-3" />
            </span>
          </div>

          <div class="wall-caption">
            <h3 class="wall-title">{{ item.title }}</h3>
            <p v-if="layout.showDesc && item.subtitle" class="wall-sub">{{ item.subtitle }}</p>
          </div>
        </div>
      </article>
    </TransitionGroup>

    <!-- 空狀態 -->
    <div v-else class="wall-empty">
      <div class="wall-empty-icon">
        <AppIcon name="image" class="size-7" />
      </div>
      <p class="wall-empty-title">{{ $t('album.wallEmpty') }}</p>
      <p class="wall-empty-hint">{{ $t('album.wallEmptyHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.album-wall {
  position: relative;
}

/* ===== 容器 ===== */
.wall-grid {
  --wall-card: 208px;
  --wall-gap: 1.15rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--wall-card), 1fr));
  gap: var(--wall-gap);
  margin-inline: auto;
  padding: 0.25rem 0 0.5rem;
}

/* 後台指定列數 */
.wall-grid[data-cols='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.wall-grid[data-cols='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.wall-grid[data-cols='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.wall-grid[data-cols='5'] { grid-template-columns: repeat(5, minmax(0, 1fr)); }

/* 瀑布流：改為多列佈局，卡片高度隨封面比例 */
.wall-grid[data-layout='masonry'] {
  display: block;
  column-count: var(--wall-mcols, 3);
  column-gap: var(--wall-gap);
}
.wall-grid[data-layout='masonry'] .wall-card {
  display: block;
  break-inside: avoid;
  margin-bottom: var(--wall-gap);
}
.wall-grid[data-layout='masonry'] .wall-frame {
  aspect-ratio: auto;
}
.wall-grid[data-layout='masonry'] .wall-img {
  height: auto;
}

/* ===== 卡片 ===== */
.wall-card {
  position: relative;
  border-radius: 1.1rem;
  outline: none;
  cursor: pointer;
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    z-index 0s;
  will-change: transform;
}

/* 錯落貼牆才帶旋轉 */
.wall-grid[data-layout='tilt'] .wall-card {
  transform: rotate(var(--tilt, 0deg));
}

/* 懸停 / 鍵盤聚焦：歸正 + 抬升 + 提升層級 */
.wall-card:hover,
.wall-card:focus-visible {
  transform: rotate(0deg) translateY(-6px) scale(1.035);
  z-index: 5;
}

.wall-frame {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: inherit;
  /* 封面缺失時的底襯，避免出現破圖空洞 */
  background: linear-gradient(
    135deg,
    rgba(var(--accent-1-rgb), 0.12),
    rgba(var(--accent-1-rgb), 0.04)
  );
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 10px 24px -12px rgba(15, 23, 42, 0.28);
  transition: box-shadow 0.4s ease;
}

.wall-card:hover .wall-frame,
.wall-card:focus-visible .wall-frame {
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 20px 44px -18px rgba(var(--accent-1-rgb), 0.5),
    0 0 0 1.5px rgba(var(--accent-1-rgb), 0.45);
}

.wall-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.wall-img.is-broken {
  opacity: 0;
}
.wall-card:hover .wall-img {
  transform: scale(1.06);
}

/* 底部漸層，保證標題在淺色封面上也可讀 */
.wall-veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgba(2, 6, 23, 0.82) 0%,
    rgba(2, 6, 23, 0.45) 36%,
    rgba(2, 6, 23, 0.06) 62%,
    transparent 100%
  );
}

/* ===== 角標 ===== */
.wall-chip {
  position: absolute;
  top: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  height: 24px;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px) saturate(1.4);
  -webkit-backdrop-filter: blur(8px) saturate(1.4);
  z-index: 2;
}
.wall-chip--count {
  left: 0.6rem;
}
.wall-chip--lock {
  right: 0.6rem;
  width: 24px;
  padding: 0;
}

/* 懸停遮罩 + 居中「查看」按鈕（避免與標題爭搶橫向空間） */
.wall-hover {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgba(2, 6, 23, 0.34);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
}
.wall-card:hover .wall-hover,
.wall-card:focus-visible .wall-hover {
  opacity: 1;
}

.wall-open {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  background: rgba(var(--accent-1-rgb), 0.92);
  box-shadow: 0 8px 20px -8px rgba(var(--accent-1-rgb), 0.9);
  transform: translateY(6px);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.wall-card:hover .wall-open,
.wall-card:focus-visible .wall-open {
  transform: translateY(0);
}

/* ===== 文字 ===== */
.wall-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 0.85rem 0.95rem 0.9rem;
  color: #fff;
  pointer-events: none;
}
.wall-title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
}
.wall-sub {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===== 空狀態 ===== */
.wall-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4.5rem 1.5rem;
  text-align: center;
  border-radius: 1.25rem;
  border: 1px dashed rgba(var(--accent-1-rgb), 0.3);
  background: rgba(var(--accent-1-rgb), 0.03);
}
.wall-empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 0.7rem;
  border-radius: 50%;
  color: var(--accent-1);
  background: rgba(var(--accent-1-rgb), 0.1);
}
.wall-empty-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #475569;
}
.wall-empty-hint {
  margin-top: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

/* ===== 進出場動畫（錯峰） ===== */
.gal-enter-active {
  transition:
    opacity 0.5s ease,
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: calc(var(--i, 0) * 45ms);
}
.gal-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.gal-enter-from,
.gal-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.96) rotate(var(--tilt, 0deg));
}

/* ===== 暗色模式 ===== */
:global(.dark) .wall-frame {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 12px 28px -14px rgba(0, 0, 0, 0.65);
}
:global(.dark) .wall-card:hover .wall-frame,
:global(.dark) .wall-card:focus-visible .wall-frame {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 22px 48px -20px rgba(var(--accent-1-rgb), 0.55),
    0 0 0 1.5px rgba(var(--accent-1-rgb), 0.5);
}
:global(.dark) .wall-empty-title {
  color: #cbd5e1;
}
:global(.dark) .wall-empty-hint {
  color: #64748b;
}

/* ===== 響應式 ===== */
@media (max-width: 640px) {
  .wall-grid {
    --wall-card: 148px;
    --wall-gap: 0.85rem;
  }
  .wall-grid[data-cols] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .wall-grid[data-layout='masonry'] {
    column-count: 2;
  }
  .wall-title {
    font-size: 0.875rem;
  }
  .wall-caption {
    padding: 0.7rem 0.75rem 0.75rem;
  }
  .wall-hover {
    display: none;
  }
}
@media (max-width: 420px) {
  .wall-grid[data-cols] {
    grid-template-columns: 1fr;
  }
  .wall-grid[data-layout='masonry'] {
    column-count: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wall-card,
  .wall-img,
  .wall-hover,
  .wall-open,
  .gal-enter-active,
  .gal-leave-active {
    transition: none !important;
  }
  .wall-card,
  .wall-card:hover,
  .wall-card:focus-visible {
    transform: none;
  }
}
</style>
