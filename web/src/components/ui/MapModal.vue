<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapInfo } from '../../types';
import AppIcon from './AppIcon.vue';
import { useI18n } from '../../composables/useI18n';

const { $t } = useI18n();
const props = defineProps<{ open: boolean; info: MapInfo | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;

const amapUrl = `https://uri.amap.com/marker?position=${props.info?.lng ?? 118.796877},${props.info?.lat ?? 32.060255}&name=${encodeURIComponent(props.info?.name ?? '')}&coordinate=gaode&callnative=0`;

const markerIcon = L.divIcon({
  className: '',
  html: `<div class="map-pin">
    <span class="map-pin-dot"></span>
    <span class="map-pin-ring"></span>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function initMap() {
  if (!mapEl.value || !props.info) return;
  if (map) {
    map.remove();
    map = null;
  }
  map = L.map(mapEl.value, {
    center: [props.info.lat, props.info.lng],
    zoom: props.info.zoom ?? 12,
    zoomControl: true,
    attributionControl: true,
  });
  // 高德瓦片底图（无需 key 的公开瓦片服务）
  L.tileLayer('https://webrd0{sub}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.amap.com/" target="_blank" rel="noopener">高德地图</a>',
  }).addTo(map);
  L.marker([props.info.lat, props.info.lng], { icon: markerIcon })
    .addTo(map)
    .bindPopup(`<b>${props.info.name}</b>${props.info.address ? `<br/><span style="color:#64748b">${props.info.address}</span>` : ''}`)
    .openPopup();
  // 弹层动画后刷新尺寸
  window.setTimeout(() => map?.invalidateSize(), 260);
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      window.setTimeout(initMap, 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKey);
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="map-fade">
      <div
        v-if="open"
        class="modal-backdrop fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
        @click.self="emit('close')"
      >
        <div
          class="modal-surface w-full max-w-2xl overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('map.mapLabel')"
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-5 py-4">
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
              >
                <AppIcon name="map-pin" class="size-4" />
              </span>
              <div class="min-w-0">
                <div class="truncate text-sm font-bold">{{ info?.name ?? $t('map.myLocation') }}</div>
                <div v-if="info?.address" class="truncate text-xs text-slate-400">{{ info.address }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <a
                :href="amapUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hidden rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-600 transition-colors hover:bg-cyan-500/10 sm:block dark:text-cyan-400"
              >
                {{ $t('map.openInAmap') }}
              </a>
              <button
                type="button"
                class="grid size-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
                :aria-label="$t('map.closeMap')"
                @click="emit('close')"
              >
                <AppIcon name="close" class="size-4" />
              </button>
            </div>
          </div>

          <!-- 地图 -->
          <div class="relative">
            <div ref="mapEl" class="h-[46vh] min-h-[300px] w-full bg-slate-100 dark:bg-slate-900 sm:h-[420px]"></div>
            <a
              :href="amapUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md transition-colors hover:text-cyan-600 dark:bg-slate-800/90 dark:text-slate-300 sm:hidden"
            >
              <AppIcon name="external" class="size-3" />
              {{ $t('map.openInAmap') }}
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* 自定义标记：青色渐变圆点 + 涟漪 */
.map-pin {
  position: relative;
  width: 26px;
  height: 26px;
}
.map-pin-dot {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #06b6d4, #2563eb);
  border: 2.5px solid #fff;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.55);
}
.map-pin-ring {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: rgba(6, 182, 212, 0.35);
  animation: map-pin-ripple 1.8s ease-out infinite;
}
@keyframes map-pin-ripple {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  100% {
    transform: scale(3.2);
    opacity: 0;
  }
}

/* 弹层动画 */
.map-fade-enter-active,
.map-fade-leave-active {
  transition: opacity 0.25s ease;
}
.map-fade-enter-active .glass,
.map-fade-leave-active .glass {
  transition: transform 0.25s ease;
}
.map-fade-enter-from,
.map-fade-leave-to {
  opacity: 0;
}
.map-fade-enter-from .glass,
.map-fade-leave-to .glass {
  transform: translateY(24px) scale(0.98);
}
</style>
