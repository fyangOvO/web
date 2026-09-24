/**
 * useMusic — 音乐播放单例 composable
 * - 模块级单例 audio 元素：避免组件切换中断播放
 * - 三类数据：pageStaticData（无）/ pageStatusData（播放状态）/ pageSubmitData（无写 API）
 * - 暴露 initMusic() 作为初始化入口
 */
import { ref, watch } from 'vue';
import type { MusicSong, LyricLine } from '../types';
import { searchMusic, getMusicLyric, getMusicStreamUrl, checkPlayable } from '../api/music';

/* ---------------- 状态（模块级单例，所有组件共享） ---------------- */
const currentSong = ref<MusicSong | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.7);
const queue = ref<MusicSong[]>([]);
const currentIndex = ref(-1);
const searchResults = ref<MusicSong[]>([]);
/** 可播放性映射：songId -> 是否可播放（查询失败则不含该项，前端不标注） */
const playableMap = ref<Record<string, boolean>>({});
/** 是否把可播放歌曲排在搜索结果前面 */
const playableFirst = ref(localStorage.getItem('music_playable_first') !== '0');
const searchKeyword = ref('');
const searching = ref(false);
const lyricLines = ref<LyricLine[]>([]);
const currentLyricIndex = ref(-1);
/** 当前行已唱到的字符下标（-1 = 未进入逐字阶段） */
const currentCharIndex = ref(-1);
/** 当前行整体进度 0~1 */
const currentLyricProgress = ref(0);
const playerOpen = ref(false);
const lyricWindowVisible = ref(false);
const loadingTrack = ref(false);
const errorMsg = ref('');
/** 浏览器拦截了自动播放，需要用户点击一次才能出声 */
const needsUserGesture = ref(false);
const initialized = ref(false);

/* ---------------- 单例 audio 元素 ---------------- */
let audio: HTMLAudioElement | null = null;

/* ---------------- 私有函数 ---------------- */

/**
 * LRC 解析：[mm:ss.xx]text 可能有多个时间标签
 * 解析后补两件事：
 *   1. 每行的 end = 下一行起始时间（末行留空，由 audio duration 兜底）
 *   2. 逐字时间轴 charTimes：按行时长对字（含空格）等分插值
 *      —— 公开接口不下发逐字轴，这里用等分推算，观感接近真逐字（长句慢亮、短句快亮）
 */
function _parseLrc(lrc: string, totalDuration = 0): LyricLine[] {
  if (!lrc) return [];
  const lines = lrc.split(/\r?\n/);
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
  for (const line of lines) {
    if (!line) continue;
    const text = line.replace(timeRegex, '').trim();
    let m: RegExpExecArray | null;
    timeRegex.lastIndex = 0;
    while ((m = timeRegex.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      const time = min * 60 + sec + ms / 1000;
      if (text) result.push({ time, text });
    }
  }
  result.sort((a, b) => a.time - b.time);

  // 计算每行结束时间 + 逐字插值
  for (let i = 0; i < result.length; i++) {
    const cur = result[i];
    const next = result[i + 1];
    const start = cur.time;
    // 末尾行：优先用总时长，其次按 4 秒兜底
    let end = next ? next.time : (totalDuration > start ? totalDuration : start + 4);
    if (end <= start) end = start + 0.6; // 同时间戳行保护
    cur.end = end;
    cur.charTimes = _buildCharTimes(cur.text, start, end);
  }
  return result;
}

/**
 * 逐字时间轴：按「可见字符权重」分配行内时间。
 * - 中日韩等宽字符权重 1，空格权重 0.35（停顿短一点），拉丁字母权重 0.55
 * - 这样英文歌词不会因为字符多而被拉得过长
 * 返回长度与 text 长度一致（text[i] 对应 charTimes[i]）
 */
function _buildCharTimes(text: string, start: number, end: number): number[] {
  const chars = Array.from(text);
  const span = Math.max(0.2, end - start);
  const weights = chars.map((ch) => {
    if (/\s/.test(ch)) return 0.35;
    if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch)) return 1;
    return 0.55;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = start;
  return weights.map((w) => {
    const t = acc;
    acc += (w / total) * span;
    return t;
  });
}

/** 二分查找当前时间对应的歌词索引 */
function _findLyricIndex(time: number): number {
  const arr = lyricLines.value;
  if (!arr.length) return -1;
  if (time < arr[0].time) return -1;
  let lo = 0, hi = arr.length - 1, res = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time <= time) { res = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return res;
}

/**
 * 当前行 + 当前字进度
 * progress: 0~1，当前行整体播放进度（用于进度条/整行高亮渐变兜底）
 * charIndex: 已唱到的字符下标（-1 表示尚未进入逐字阶段）
 */
function _computeCharState(time: number, idx: number) {
  const arr = lyricLines.value;
  if (idx < 0 || idx >= arr.length) return { progress: 0, charIndex: -1 };
  const line = arr[idx];
  const start = line.time;
  const end = line.end ?? start + 4;
  const span = Math.max(0.05, end - start);
  const progress = Math.max(0, Math.min(1, (time - start) / span));
  const ct = line.charTimes;
  if (!ct || !ct.length) return { progress, charIndex: -1 };
  // 已唱字数 = 最后一个 charTime <= time 的下标 + 1
  let lo = 0, hi = ct.length - 1, lit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ct[mid] <= time) { lit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return { progress, charIndex: lit };
}

/** 加载歌词 */
async function _fetchLyric(id: string) {
  try {
    const raw = await getMusicLyric(id);
    // 元数据（作词/作曲行）过滤掉，避免歌词窗一开始全是制作人员
    lyricLines.value = _parseLrc(raw.lrc, duration.value || 0).filter(
      (l) => !/^(\[.*\])?\s*(作词|作曲|编曲|制作人|录音|混音|吉他|贝斯|鼓|和声|母带|监制|发行|出品|统筹|OP|SP)\s*[:：]/.test(l.text),
    );
  } catch {
    lyricLines.value = [];
  }
  currentLyricIndex.value = -1;
  currentCharIndex.value = -1;
  currentLyricProgress.value = 0;
}

/* ---------------- 事件处理 ---------------- */
function _onTimeUpdate() {
  if (!audio) return;
  currentTime.value = audio.currentTime;
  if (lyricLines.value.length) {
    const idx = _findLyricIndex(audio.currentTime);
    if (idx !== currentLyricIndex.value) currentLyricIndex.value = idx;
    const st = _computeCharState(audio.currentTime, idx);
    currentLyricProgress.value = st.progress;
    currentCharIndex.value = st.charIndex;
  }
}
function _onLoadedMetadata() {
  if (!audio) return;
  duration.value = audio.duration || 0;
  // 拿到总时长后重算末行结束时间
  if (lyricLines.value.length) {
    const last = lyricLines.value[lyricLines.value.length - 1];
    if (last && (!last.end || last.end <= last.time)) {
      lyricLines.value = _parseLrc(
        lyricLines.value.map((l) => `[${_fmtTime(l.time)}]${l.text}`).join('\n'),
        duration.value,
      );
    }
  }
}

/** 秒 -> [mm:ss.xx] 标签（用于重解析） */
function _fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
function _onPlay() { isPlaying.value = true; }
function _onPause() { isPlaying.value = false; }
function _onEnded() {
  isPlaying.value = false;
  next();
}
function _onError() {
  isPlaying.value = false;
  loadingTrack.value = false;
  // 区分「网络/服务端失败」与「解码失败」，给出可操作提示
  const code = audio?.error?.code;
  if (code === 4 || code === 3) {
    errorMsg.value = '音频加载失败，可能无版权或该歌曲受限';
  } else {
    errorMsg.value = '音频加载失败，请检查网络或稍后重试';
  }
}

/** 是否为「自动播放被浏览器拦截」类错误 */
function _isAutoplayBlocked(e: unknown): boolean {
  const name = (e as { name?: string })?.name || '';
  const msg = String((e as { message?: string })?.message || '');
  return (
    name === 'NotAllowedError' ||
    /not allowed|user gesture|user interaction|interact/i.test(msg)
  );
}

/* ---------------- 公共函数 ---------------- */

/** 初始化单例 audio 与事件监听（仅在 App.vue 调用一次） */
function initMusic() {
  if (initialized.value) return;
  audio = new Audio();
  audio.preload = 'auto';
  audio.volume = volume.value;
  audio.addEventListener('timeupdate', _onTimeUpdate);
  audio.addEventListener('loadedmetadata', _onLoadedMetadata);
  audio.addEventListener('play', _onPlay);
  audio.addEventListener('playing', _onPlay);
  audio.addEventListener('pause', _onPause);
  audio.addEventListener('ended', _onEnded);
  audio.addEventListener('error', _onError);
  initialized.value = true;
}

/** 搜索 */
async function search(keyword?: string) {
  const kw = (keyword ?? searchKeyword.value).trim();
  if (!kw) return;
  searching.value = true;
  errorMsg.value = '';
  try {
    searchResults.value = await searchMusic(kw);
    if (!searchResults.value.length) {
      errorMsg.value = '没有找到相关歌曲';
      playableMap.value = {};
    } else {
      // 异步标注可播放性，不阻塞结果展示
      void markPlayability(searchResults.value.map((s) => s.id));
    }
  } catch {
    searchResults.value = [];
    playableMap.value = {};
    errorMsg.value = '搜索失败，请稍后再试';
  } finally {
    searching.value = false;
  }
}

/**
 * 批量检查并记录可播放性（失败静默，不影响主流程）
 * 拿到结果后按「可播放优先」重排搜索结果，避免用户在一堆 VIP 歌曲里找能播的。
 * 注意：只重排 searchResults（展示用），已入队的 queue 顺序保持不变，
 *      否则 currentIndex 会错位。
 */
async function markPlayability(ids: string[]) {
  const map = await checkPlayable(ids);
  playableMap.value = { ...playableMap.value, ...map };
  if (playableFirst.value) sortResultsByPlayable();
}

/**
 * 可播放优先排序（稳定排序，保持原有相对顺序）。
 * 未知状态（查询失败/尚未返回）视为「不劣于受限」，排在受限之前但不越过可播放。
 */
function sortResultsByPlayable() {
  const list = searchResults.value;
  if (list.length < 2) return;
  const rank = (id: string): number => {
    const v = playableMap.value[id];
    if (v === true) return 0; // 可播放
    if (v === false) return 2; // 明确受限
    return 1; // 未知
  };
  searchResults.value = list
    .map((song, i) => ({ song, i, r: rank(song.id) }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((x) => x.song);
}

/** 切换「可播放优先」时立即重排，并持久化偏好 */
watch(playableFirst, (v) => {
  localStorage.setItem('music_playable_first', v ? '1' : '0');
  if (v) sortResultsByPlayable();
});

/** 播放指定歌曲（可选传入新队列） */
async function playSong(song: MusicSong, newQueue?: MusicSong[]) {
  if (!audio) initMusic();
  if (!audio) return;
  loadingTrack.value = true;
  errorMsg.value = '';
  if (newQueue && newQueue.length) {
    queue.value = newQueue;
    currentIndex.value = newQueue.findIndex((s) => s.id === song.id);
    if (currentIndex.value < 0) {
      queue.value = [song, ...newQueue];
      currentIndex.value = 0;
    }
  } else if (!queue.value.length) {
    queue.value = [song];
    currentIndex.value = 0;
  } else {
    const idx = queue.value.findIndex((s) => s.id === song.id);
    if (idx >= 0) currentIndex.value = idx;
    else { queue.value = [song, ...queue.value]; currentIndex.value = 0; }
  }
  currentSong.value = song;
  audio.src = getMusicStreamUrl(song.id);
  audio.load();
  try {
    await audio.play();
    needsUserGesture.value = false;
  } catch (e) {
    // 前端已知该曲不可播放（搜索结果里已标注），直接给明确提示
    if (playableMap.value[song.id] === false) {
      errorMsg.value = `「${song.name}」为 VIP / 版权受限歌曲，无法播放，请换一首`;
      needsUserGesture.value = false;
    } else if (_isAutoplayBlocked(e)) {
      // 浏览器自动播放策略：需要一次用户手势。不当作错误，给出可操作提示。
      needsUserGesture.value = true;
      errorMsg.value = '';
    } else {
      errorMsg.value = '播放启动失败，请点击播放按钮重试';
    }
  }
  loadingTrack.value = false;
  void _fetchLyric(song.id);
}

/**
 * 用户手势后的「解锁播放」。
 * 浏览器要求 audio.play() 必须发生在用户手势的调用栈内，
 * 因此点击播放/切换歌曲时调用此函数即可正常播放。
 */
async function resumeByUserGesture() {
  if (!audio || !currentSong.value) return;
  try {
    await audio.play();
    needsUserGesture.value = false;
    errorMsg.value = '';
  } catch (e) {
    if (_isAutoplayBlocked(e)) needsUserGesture.value = true;
    else errorMsg.value = '播放失败，请稍后重试';
  }
}

function togglePlay() {
  if (!audio || !currentSong.value) return;
  if (audio.paused) {
    // 点击本身就属于用户手势，直接播放即可
    void resumeByUserGesture();
  } else {
    audio.pause();
  }
}

function next() {
  if (!queue.value.length) return;
  const idx = (currentIndex.value + 1) % queue.value.length;
  void playSong(queue.value[idx]);
}

function prev() {
  if (!queue.value.length) return;
  const idx = (currentIndex.value - 1 + queue.value.length) % queue.value.length;
  void playSong(queue.value[idx]);
}

function seek(t: number) {
  if (!audio) return;
  audio.currentTime = Math.max(0, Math.min(t, duration.value || 0));
  currentTime.value = audio.currentTime;
}

function setVolume(v: number) {
  volume.value = v;
  if (audio) audio.volume = v;
}

function togglePlayer() { playerOpen.value = !playerOpen.value; }
function openPlayer() { playerOpen.value = true; }
function closePlayer() { playerOpen.value = false; }
function toggleLyricWindow() { lyricWindowVisible.value = !lyricWindowVisible.value; }

export function useMusic() {
  return {
    // 状态
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue,
    currentIndex,
    searchResults,
    searchKeyword,
    playableMap,
    playableFirst,
    searching,
    lyricLines,
    currentLyricIndex,
    currentCharIndex,
    currentLyricProgress,
    playerOpen,
    lyricWindowVisible,
    loadingTrack,
    errorMsg,
    needsUserGesture,
    initialized,
    // 方法
    initMusic,
    search,
    playSong,
    togglePlay,
    resumeByUserGesture,
    next,
    prev,
    seek,
    setVolume,
    togglePlayer,
    openPlayer,
    closePlayer,
    toggleLyricWindow,
  };
}
