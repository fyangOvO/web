/**
 * 网易云音乐代理（通过本地代理访问）
 * - 使用 undici 的 ProxyAgent + fetch 连接 music.163.com 公开 API
 * - 支持环境变量 MUSIC_PROXY 配置代理地址（默认 http://127.0.0.1:7897）
 * - search / lyric / detail：JSON 透传
 * - stream：pipe 音频流（支持 Range seek）
 *
 * 路由前缀：/api/music
 */
const express = require('express');
const { ProxyAgent, fetch: undiciFetch } = require('undici');
const { URL } = require('node:url');

const router = express.Router();

/** 上游域名（公开 API） */
const UPSTREAM_BASE = (process.env.MUSIC_API_BASE || 'https://music.163.com').replace(/\/+$/, '');

/**
 * 代理地址（可选）
 * - 設置 MUSIC_PROXY 時走代理（適合需要科學上網的環境）
 * - 未設置時直連（大陸可直接訪問 music.163.com，無需代理）
 * - 設為字串 "none"/"off" 可強制直連
 */
const RAW_PROXY = (process.env.MUSIC_PROXY || '').trim();
const PROXY_DISABLED = /^(none|off|false|0)$/i.test(RAW_PROXY);
const PROXY_URL = PROXY_DISABLED ? '' : RAW_PROXY;

/** ProxyAgent（僅在配置了代理時創建） */
let dispatcher;
if (PROXY_URL) {
  try {
    dispatcher = new ProxyAgent(PROXY_URL);
  } catch (e) {
    console.warn(`[music] 代理创建失败，已回退直连：${String(e && e.message || e)}`);
    dispatcher = undefined;
  }
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REFERER = 'https://music.163.com/';

/** 通用请求头 */
function upstreamHeaders(range) {
  const h = {
    'User-Agent': UA,
    Referer: REFERER,
    Accept: '*/*',
  };
  if (range) h.Range = range;
  return h;
}

/** 上游请求超时（毫秒） */
const UPSTREAM_TIMEOUT = Number(process.env.MUSIC_TIMEOUT || 12000);

/**
 * 带超时的 fetch 封装
 * - 用 AbortController 防止「建连 + 响应头」阶段悬挂
 * - ⚠️ 关键：一旦拿到响应头，必须「解绑」signal 再返回。
 *   否则定时器触发 abort 会掐断正在读取的 body 流（TypeError: terminated），
 *   表现为后端返回 200 但 body 为空（大文件音频流尤其容易踩到）。
 * - 网络类错误（fetch failed）自动重试一次
 */
async function fetchWithTimeout(url, options = {}, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT);
    try {
      const r = await undiciFetch(url, { ...options, signal: ctrl.signal });
      // 用不到 signal 了：清计时器即可，signal 不会自己触发（已 clearTimeout）
      clearTimeout(timer);
      return r;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr;
}

/**
 * 专供「流式传输」的 fetch：超时只作用于建连与响应头阶段。
 * 拿到响应头后立即用「永不过期的 signal」替换，确保长音频 body 不会被超时掐断。
 */
async function fetchStreamWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT);
  try {
    const r = await undiciFetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    // undici 的 Response 已持有内部流；这里再返回时不再有定时器，
    // 因此 body 读取不会被 abort 影响。
    return r;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * 取 JSON（代理优先，失败回退直连）
 * 供 stream 路由解析音频元信息使用
 */
async function fetchJsonWithFallback(url) {
  const attempt = async (d) => {
    const r = await fetchWithTimeout(url, { headers: upstreamHeaders(), dispatcher: d });
    return await r.json();
  };
  try {
    return await attempt(dispatcher);
  } catch (e) {
    if (dispatcher) {
      console.warn(`[music] 代理取元信息失败，回退直连：${String(e && e.message || e)}`);
      return await attempt(undefined);
    }
    throw e;
  }
}

/** 透传 fetch JSON（使用代理；失败时回退直连） */
async function proxyJson(req, res, upstreamUrl) {
  const attempt = async (useDispatcher) => {
    const r = await fetchWithTimeout(upstreamUrl, {
      headers: upstreamHeaders(),
      dispatcher: useDispatcher,
    });
    const text = await r.text();
    return { status: r.status, text };
  };

  try {
    let out;
    try {
      out = await attempt(dispatcher);
    } catch (e) {
      // 配了代理但连不上：自动回退为直连
      if (dispatcher) {
        console.warn(`[music] 代理请求失败，回退直连：${String(e && e.message || e)}`);
        out = await attempt(undefined);
      } else {
        throw e;
      }
    }
    res.status(out.status).type('application/json; charset=utf-8').send(out.text);
  } catch (e) {
    res.status(502).json({
      error: '上游请求失败',
      detail: String(e && e.message || e),
      hint: dispatcher
        ? `代理与直连均失败，请检查网络或调整 MUSIC_PROXY（当前：${PROXY_URL}）`
        : '请检查服务器能否访问 music.163.com（可设置 MUSIC_PROXY 走代理）',
    });
  }
}

/* ---------- 搜尋 ---------- */
router.get('/search', (req, res) => {
  const s = String(req.query.s || '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (!s) return res.status(400).json({ error: '缺少参数 s' });
  const url = `${UPSTREAM_BASE}/api/search/get?s=${encodeURIComponent(s)}&type=1&limit=${limit}`;
  return proxyJson(req, res, url);
});

/**
 * 批量查询可播放性
 * GET /api/music/playable?ids=1,2,3
 * -> { playable: { "1": true, "2": false } }
 *
 * 用途：搜索结果里提前标注哪些歌能放，避免用户点了才发现是 VIP/版权受限。
 */
router.get('/playable', async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!ids.length) return res.status(400).json({ error: '缺少参数 ids' });

  const url =
    `${UPSTREAM_BASE}/api/song/enhance/player/url?ids=[${ids.join(',')}]` +
    `&id=${ids[0]}&br=320000`;
  try {
    const json = await fetchJsonWithFallback(url);
    const list = Array.isArray(json?.data) ? json.data : [];
    const playable = {};
    ids.forEach((id) => { playable[id] = false; });
    list.forEach((item) => {
      if (item && item.id != null) playable[String(item.id)] = !!item.url;
    });
    return res.json({ playable });
  } catch (e) {
    // 查询失败时不阻塞前端：全部标为「未知」即不标注
    return res.json({ playable: {}, error: String(e && e.message || e) });
  }
});

/* ---------- 歌詞 ---------- */
router.get('/lyric', (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: '缺少参数 id' });
  const url = `${UPSTREAM_BASE}/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&tv=-1`;
  return proxyJson(req, res, url);
});

/* ---------- 歌曲詳情 ---------- */
router.get('/detail', (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: '缺少参数 id' });
  const url = `${UPSTREAM_BASE}/api/song/detail/?ids=[${encodeURIComponent(id)}]`;
  return proxyJson(req, res, url);
});

/* ---------- 音頻流代理（支援 Range） ---------- */

/**
 * 使用 undici 的 fetch 取得音頻流並 pipe 到 res。
 * 支援 Range header 與 301/302 重定向跟隨。
 */
async function pipeUpstream(targetUrl, req, res, redirectCount = 0, useDispatcher = dispatcher) {
  if (redirectCount > 5) {
    return res.status(502).json({ error: '重定向次数过多' });
  }

  try {
    let r;
    try {
      // 用 fetchStreamWithTimeout：超时只作用于建连/响应头，不掐断长音频 body
      r = await fetchStreamWithTimeout(targetUrl, {
        method: 'GET',
        headers: upstreamHeaders(req.headers.range),
        dispatcher: useDispatcher,
        redirect: 'manual', // 手動跟隨以保留 Range
      });
    } catch (e) {
      // 代理不可用则回退直连重试一次
      if (useDispatcher) {
        console.warn(`[music] 音频代理失败，回退直连：${String(e && e.message || e)}`);
        return pipeUpstream(targetUrl, req, res, redirectCount, undefined);
      }
      throw e;
    }

    // 跟隨重定向
    if (
      (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) &&
      r.headers.get('location')
    ) {
      try { await r.body.cancel(); } catch (_) { /* ignore */ }
      const next = new URL(r.headers.get('location'), targetUrl).href;
      return pipeUpstream(next, req, res, redirectCount + 1, useDispatcher);
    }

    // 上游非 2xx 时明确报错，避免「200 + 空 body」的静默失败
    if (!r.ok && r.status !== 206) {
      try { await r.body.cancel(); } catch (_) { /* ignore */ }
      return res.status(502).json({
        error: '上游音频返回异常',
        detail: `upstream status ${r.status}`,
      });
    }

    // 透传关键响应头
    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
    const headers = { 'Cache-Control': 'public, max-age=3600' };
    passHeaders.forEach((k) => {
      const v = r.headers.get(k);
      if (v) headers[k] = v;
    });
    if (!headers['accept-ranges']) headers['accept-ranges'] = 'bytes';

    res.writeHead(r.status || 200, headers);

    // pipe body
    if (!r.body) return res.end();
    const reader = r.body.getReader();
    let finished = false;
    /**
     * 客户端提前断开（换歌 / 关闭页面）时释放上游连接。
     * ⚠️ 这里绝对不要调用 res.end()：
     *    实测 Node 会在「响应尚未写入任何数据」时立刻触发 res 的 'close'，
     *    若在 close 回调里 res.end()，会导致「200 + 空 body」的静默失败。
     *    响应的收尾统一交给下面的 pump()。
     */
    const abortUpstream = () => {
      if (finished) return;
      try { void reader.cancel(); } catch (_) { /* ignore */ }
    };
    res.on('close', abortUpstream);

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (res.writableEnded || res.destroyed) break;
          if (!res.write(value)) {
            // backpressure：等待 drain；客户端断开则立即退出，避免永久挂起
            await new Promise((resolve) => {
              const onDone = () => {
                res.off('drain', onDone);
                res.off('close', onDone);
                resolve();
              };
              res.once('drain', onDone);
              res.once('close', onDone);
            });
          }
        }
        if (!res.writableEnded) res.end();
      } catch (e) {
        // 客户端主动断开（换歌/关页面）属正常，不刷错误日志
        if (!res.destroyed) {
          console.warn(`[music] 音频流转发中断：${String(e && e.message || e)}`);
        }
        try { if (!res.writableEnded) res.end(); } catch (_) { /* ignore */ }
      } finally {
        finished = true;
        res.off('close', abortUpstream);
      }
    };
    void pump();
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({
        error: '上游请求失败',
        detail: String(e && e.message || e),
        hint: dispatcher
          ? `代理与直连均失败，请检查网络或调整 MUSIC_PROXY（当前：${PROXY_URL}）`
          : '请检查服务器能否访问 music.163.com（可设置 MUSIC_PROXY 走代理）',
      });
    }
  }
}

router.get('/stream', async (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: '缺少参数 id' });

  // 1. 先調用 enhance/player/url 取得真實音頻 URL
  //    ids 需要是 JSON 数组形式（不要对 [ ] 做 encodeURIComponent，否则上游解析不到）
  const metaUrl =
    `${UPSTREAM_BASE}/api/song/enhance/player/url` +
    `?id=${encodeURIComponent(id)}&ids=%5B${encodeURIComponent(id)}%5D&br=320000`;
  try {
    const metaJson = await fetchJsonWithFallback(metaUrl);
    const songInfo = (metaJson.data && metaJson.data[0]) || {};
    const audioUrl = songInfo.url;

    if (!audioUrl) {
      // 版權受限 / VIP / 下架，無法播放
      return res.status(403).json({
        error: '無法播放',
        reason: 'restricted',
        code: songInfo.code || 0,
        fee: songInfo.fee,
        detail: '此歌曲因版權限制無法獲取音頻 URL（可能為 VIP 或下架歌曲）',
        hint: '请换一首歌试试',
      });
    }

    // 2. pipe 真實音頻流（支援 Range seek）
    return pipeUpstream(audioUrl, req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({
        error: '上游请求失败',
        detail: String(e && e.message || e),
        hint: dispatcher
          ? `代理与直连均失败，请检查网络或调整 MUSIC_PROXY（当前：${PROXY_URL}）`
          : '请检查服务器能否访问 music.163.com（可设置 MUSIC_PROXY 走代理）',
      });
    }
  }
});

module.exports = router;
