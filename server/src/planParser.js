/**
 * 计划文档解析器
 *
 * 把上传的 Markdown（或 HTML）计划文档解析成站点通用的 Plan 结构草稿，
 * 让「上传文件 → 自动生成和现有计划一模一样的页面」成为可能。
 *
 * 解析能力：
 *   - `# 标题`            → plan.title
 *   - 标题下的短句/段落    → plan.subtitle / plan.summary
 *   - `## 小节`           → plan.sections[]，自动判定渲染形态：
 *                          表格→table、有序步骤→timeline、带小标题的列表→cards、
 *                          普通列表→list、纯段落→text、含金额的预算节→budget
 *   - `### 子标题`        → timeline 的节点（如「逐日行程」的每一天、「三道菜」的每道菜）
 *   - 末尾「注意事项/提醒/要点」类小节 → plan.tips[]
 *   - 正文里的日期、天数、人数、金额 → plan.meta[]（封面关键数字）
 *
 * 设计原则：**保守解析，绝不丢内容**。判不准就退回 list / text。
 */

/* ---------------- 分类预设 ---------------- */

const CATEGORY_PRESETS = {
  travel: {
    emoji: '🧳',
    gradient: 'from-cyan-600 via-sky-700 to-blue-800',
    words: ['旅行', '旅游', '行程', '攻略', '路线', '出行', '自由行', '自驾', '音乐节之旅', '看海', '古镇', '徒步', '露营', '机票', '高铁'],
  },
  tech: {
    emoji: '🖥️',
    gradient: 'from-violet-600 via-indigo-700 to-blue-900',
    words: ['装机', '升级', '配置', '电脑', '显卡', 'cpu', '主机', '数码', '硬件', '主板', '内存', '散热', '电源', '固态'],
  },
  game: {
    emoji: '🎮',
    gradient: 'from-rose-500 via-fuchsia-600 to-purple-800',
    words: ['游戏', 'mod', '模组', '整合包', 'steam', '联机', '存档', '开黑'],
  },
  health: {
    emoji: '💪',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    words: ['减脂', '健身', '训练', '饮食', '营养', '体重', '运动', '健康', '热量', '蛋白', '睡眠'],
  },
  life: {
    emoji: '🍳',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    words: ['下厨', '菜谱', '做饭', '食谱', '生活', '家常菜', '早餐', '晚餐', '烘焙'],
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_PRESETS);

/** 小节标题命中这些词 → 一定归入 tips */
const TIP_TITLE_STRICT_RE = /(注意事项|必读|风险|避坑|免责|贴士|黄金法则|出行须知)/;
/** 命中这些词 → 只有当它是最后一个小节时才归入 tips */
const TIP_TITLE_LOOSE_RE = /(注意|提醒|要点|提示|建议|须知)/;
const TIP_TITLE_RE = /(注意事项|必读|风险|避坑|免责|贴士|黄金法则|出行须知|注意|提醒|要点|提示|建议|须知)/;
/** 小节标题命中这些词 → 倾向解析成 timeline */
const TIMELINE_TITLE_RE = /(行程|日程|时间线|流程|步骤|安排|顺序|优先级|阶段|逐日|每日|路线图|做法|工序)/;
/** 小节标题命中这些词 → 倾向解析成 budget */
const BUDGET_TITLE_RE = /(预算|花费|费用|开销|成本|账单|价格)/;
/** 小节标题命中这些词 → 倾向解析成 cards */
const CARDS_TITLE_RE = /(亮点|特色|推荐|清单|梯队|候选|方案|对比|一览|速览|装备|食材)/;

const TIME_RE = /^(\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*[点时]|\d{1,2}\s*[-–~]\s*\d{1,2}\s*[点时]|上午|中午|下午|傍晚|晚上|早上|凌晨|备选|第\s*\d+\s*分钟|Day\s*\d+|D\d+)/i;
const AMOUNT_RE = /(¥|￥|\$)\s*[\d,]+(?:\.\d+)?|[\d,]+\s*(?:元|块|rmb)/i;

/* ---------------- HTML → Markdown ---------------- */

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&times;': '×',
};

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** 把 HTML 降级成 Markdown 风格的纯文本（只保留结构，不追求完美还原） */
function htmlToMarkdown(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '');

  // 表格：先整表转成 Markdown 表格
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows = [];
    const trRe = /<tr[\s\S]*?<\/tr>/gi;
    let tr;
    while ((tr = trRe.exec(table))) {
      const cells = [];
      const cellRe = /<(td|th)[\s\S]*?<\/\1>/gi;
      let cell;
      while ((cell = cellRe.exec(tr[0]))) {
        cells.push(
          decodeEntities(cell[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).replace(/\|/g, '\\|')
        );
      }
      if (cells.length) rows.push('| ' + cells.join(' | ') + ' |');
    }
    if (!rows.length) return '';
    const cols = rows[0].split('|').length - 2;
    return '\n' + rows[0] + '\n|' + ' --- |'.repeat(Math.max(cols, 1)) + '\n' + rows.slice(1).join('\n') + '\n';
  });

  // 标题
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lv, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return `\n\n${'#'.repeat(Number(lv))} ${text}\n\n`;
  });

  // 列表项（<ol> 内的 <li> 统一先用 - 表示，后续按顺序号还原）
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return `\n- ${text}`;
  });

  // 段落 / 换行 / 分隔
  s = s.replace(/<\/(p|div|section|article|blockquote|tr|ul|ol|h[1-6])>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 行内强调
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // 去掉剩余标签 + 解码实体
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s;
}

/* ---------------- 行内文本清洗 ---------------- */

/** 去掉 Markdown 强调 / 链接 / 行内代码标记，保留文字 */
function stripMd(s) {
  return String(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 拆出开头的 emoji，返回 { emoji, rest } */
const EMOJI_RE = /^([\u203c-\u3299\u{1f000}-\u{1faff}\u{2600}-\u{27bf}\u{fe0f}\u{200d}]+)\s*/u;
function splitEmoji(s) {
  const m = EMOJI_RE.exec(String(s));
  if (!m) return { emoji: '', rest: String(s).trim() };
  return { emoji: m[1].replace(/\u{fe0f}/gu, ''), rest: String(s).slice(m[0].length).trim() };
}

/** `**标题**：描述` / `标题 —— 描述` → { title, desc } */
function splitTitleDesc(raw) {
  let m = /^\*\*(.+?)\*\*\s*[：:—–\-]\s*(.*)$/.exec(raw.trim());
  if (m) return { title: stripMd(m[1]), desc: stripMd(m[2]) };
  m = /^(.+?)\s+[—–]\s+(.+)$/.exec(raw.trim());
  if (m) return { title: stripMd(m[1]), desc: stripMd(m[2]) };
  m = /^(.+?)\s*[：:]\s*(.+)$/.exec(raw.trim());
  if (m && m[1].length <= 24) return { title: stripMd(m[1]), desc: stripMd(m[2]) };
  return null;
}

/* ---------------- Markdown 分块 ---------------- */

function parseTableRows(rawRows) {
  const rows = rawRows.map((r) =>
    r
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => stripMd(c.replace(/\\\|/g, '|')))
  );
  // 丢弃 `| --- | --- |` 分隔行
  return rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c.trim())));
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const t = rawLine.trim();
    if (!t) {
      i++;
      continue;
    }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: stripMd(h[2]) });
      i++;
      continue;
    }

    // 表格
    if (t.startsWith('|') && t.endsWith('|') && t.length > 2) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim());
        i++;
      }
      const parsed = parseTableRows(rows);
      if (parsed.length) blocks.push({ type: 'table', rows: parsed });
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(t)) {
      const items = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (/^[-*+]\s+/.test(lt)) {
          items.push(lt.replace(/^[-*+]\s+/, ''));
          i++;
        } else if (lt && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lt;
          i++;
        } else break;
      }
      if (items.length) blocks.push({ type: 'ul', items });
      continue;
    }

    // 有序列表
    const ol = /^(\d{1,2})[.、)]\s+(.*)$/.exec(t);
    if (ol) {
      const items = [];
      while (i < lines.length) {
        const m = /^(\d{1,2})[.、)]\s+(.*)$/.exec(lines[i].trim());
        if (m) {
          items.push({ n: Number(m[1]), text: m[2] });
          i++;
        } else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      if (items.length) blocks.push({ type: 'ol', items });
      continue;
    }

    // 引用
    if (t.startsWith('>')) {
      blocks.push({ type: 'quote', text: stripMd(t.replace(/^>\s?/, '')) });
      i++;
      continue;
    }

    // 分隔线
    if (/^([-*_])\1{2,}$/.test(t)) {
      i++;
      continue;
    }

    // 段落
    blocks.push({ type: 'p', text: stripMd(t) });
    i++;
  }
  return blocks;
}

/* ---------------- 组装 Section ---------------- */

/** 把 h3 及其后续内容分组；`leading` 是第一个 h3 之前的内容（不能丢） */
function groupByH3(blocks) {
  const groups = [];
  const leading = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === 'heading' && b.level >= 3) {
      cur = { title: b.text, blocks: [] };
      groups.push(cur);
    } else if (cur) {
      cur.blocks.push(b);
    } else {
      leading.push(b);
    }
  }
  return { groups, leading };
}

/** 中文数字 → 阿拉伯数字（仅支持 1-99 的常见写法） */
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function cnToNumber(s) {
  const str = String(s).trim();
  if (/^\d+$/.test(str)) return Number(str);
  if (!/^[零一二两三四五六七八九十]+$/.test(str)) return null;
  if (str === '十') return 10;
  if (str.length === 1) return CN_DIGITS[str] ?? null;
  const idx = str.indexOf('十');
  if (idx >= 0) {
    const tens = idx === 0 ? 1 : CN_DIGITS[str[idx - 1]] ?? 1;
    const ones = idx === str.length - 1 ? 0 : CN_DIGITS[str[idx + 1]] ?? 0;
    return tens * 10 + ones;
  }
  return null;
}

/** 去掉「一、」「1.」「①」这类序号前缀 */
function stripOrdinal(s) {
  return String(s)
    .replace(/^[（(]?\s*[零一二两三四五六七八九十\d]{1,3}\s*[)）]?\s*[、.．,，:：)）]\s*/, '')
    .replace(/^[①-⑳]\s*/, '')
    .trim();
}

/** 列表项 → PlanNodeItem[]（带时间前缀的拆成 time + label） */
function listToItems(items) {
  return items.map((raw) => {
    const text = stripMd(raw);
    const m = TIME_RE.exec(text);
    if (m && m[0].length < text.length) {
      const time = m[0].trim();
      const label = text.slice(m[0].length).replace(/^[\s·—–\-:：]+/, '').trim();
      return label ? { time, label } : { label: text };
    }
    return { label: text };
  });
}

function flattenList(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'ul') out.push(...b.items);
    else if (b.type === 'ol') out.push(...b.items.map((it) => it.text));
  }
  return out;
}

/** 判断列表是否适合渲染成卡片 */
function looksLikeCards(items) {
  if (!items.length || items.length > 16) return false;
  let hits = 0;
  for (const raw of items) {
    if (splitTitleDesc(raw)) {
      hits++;
      continue;
    }
    const { emoji, rest } = splitEmoji(raw);
    if (emoji && rest.length <= 60) hits++;
  }
  return hits >= Math.ceil(items.length * 0.6);
}

/** 解析「预算」类小节 → PlanBudgetItem[] */
function parseBudget(items) {
  const out = [];
  for (const raw of items) {
    const text = stripMd(raw);
    const m = /^(.*?)\s*[：:—–\-]?\s*((?:¥|￥|\$)\s*[\d,]+(?:\.\d+)?|[\d,]+\s*(?:元|块))\s*(.*)$/.exec(text);
    if (m && m[1]) {
      out.push({
        label: m[1].replace(/[：:—–\-]\s*$/, '').trim(),
        amount: m[2].replace(/\s+/g, ''),
        ...(m[3] ? { note: m[3].replace(/^[（(]\s*|\s*[)）]$/g, '').trim() } : {}),
      });
    } else if (AMOUNT_RE.test(text)) {
      const am = AMOUNT_RE.exec(text)[0];
      out.push({ label: text.replace(am, '').replace(/[：:—–\-]\s*$/, '').trim() || '项目', amount: am.replace(/\s+/g, '') });
    } else if (text) {
      out.push({ label: text, amount: '' });
    }
  }
  return out.filter((b) => b.label);
}

/** 一个 h3 分组 → PlanNode */
function groupToNode(group, index) {
  const { title, blocks } = group;
  const { emoji, rest } = splitEmoji(title);
  // 「10.1 周四 · 奔赴聊城」→ meta 取日期，标题取后半段
  let nodeTitle = rest;
  let meta = '';
  const dateMatch = /^(\d{1,2}\s*[.\-/]\s*\d{1,2}(?:\s*[（(][^)）]*[)）])?)\s*(?:[·—–\-]\s*)?(.*)$/.exec(rest);
  if (dateMatch && dateMatch[2]) {
    meta = dateMatch[1].trim();
    nodeTitle = dateMatch[2].trim();
  } else {
    const dayMatch = /^(Day\s*\d+|D\d+|第\s*\d+\s*[天日周])[:：]?\s*(.*)$/i.exec(rest);
    if (dayMatch) {
      meta = dayMatch[1];
      nodeTitle = dayMatch[2] || rest;
    }
  }
  const tags = [];
  const paragraphs = blocks.filter((b) => b.type === 'p').map((b) => b.text);
  const quotes = blocks.filter((b) => b.type === 'quote').map((b) => b.text);
  const listItems = flattenList(blocks);
  const table = blocks.find((b) => b.type === 'table');

  // 标签：短行（<=6 字）且不是列表的段落，视作标签
  const descParts = [];
  for (const p of [...paragraphs, ...quotes]) {
    if (p.length <= 6 && !descParts.length) tags.push(p);
    else descParts.push(p);
  }

  const node = {
    badge: String(index + 1),
    title: stripOrdinal(nodeTitle || rest) || rest || `第 ${index + 1} 部分`,
  };
  if (meta) node.meta = meta;
  if (emoji) node.emoji = emoji;
  if (tags.length) node.tags = tags.slice(0, 4);
  if (descParts.length) node.desc = descParts.join(' ');
  if (listItems.length) node.items = listToItems(listItems);
  if (table) {
    // h3 里的小表格 → 以 footer 之外的形式附在 desc 后（保内容不丢）
    const rows = table.rows.slice(1).map((r) => r.join('：'));
    if (rows.length) node.desc = [node.desc, rows.join('；')].filter(Boolean).join(' ');
  }
  return node;
}

/** 把若干块里的表格压成一句话（用于「保内容不丢」的兜底展示） */
function tableToText(table) {
  if (!table || !table.rows.length) return '';
  const head = table.rows[0];
  return table.rows
    .slice(1)
    .map((r) => r.map((c, i) => (i === 0 ? c : `${head[i] || ''} ${c}`.trim())).join('：'))
    .join('；');
}

/** 单个 ## 小节 → PlanSection[]（可能拆成多个：前置表格 + 主体） */
function sectionToPlanSection(sec) {
  const title = sec.title || '';
  const blocks = sec.blocks;

  const { groups: h3Groups, leading } = groupByH3(blocks);
  const table = blocks.find((b) => b.type === 'table');
  const listItems = flattenList(blocks);
  const leadParagraphs = leading.filter((b) => b.type === 'p' || b.type === 'quote').map((b) => b.text);
  const leadTable = leading.find((b) => b.type === 'table');
  const leadText = leadParagraphs.join(' ');

  // 1) 有 ### 子标题 → 时间线（逐日行程 / 三道菜 / 升级阶段）
  if (h3Groups.length >= 2) {
    const descParts = [leadText, tableToText(leadTable)].filter(Boolean);
    return [
      {
        icon: 'calendar',
        title: title || '详细内容',
        ...(descParts.length ? { desc: descParts.join(' ') } : {}),
        kind: 'timeline',
        nodes: h3Groups.map((g, i) => groupToNode(g, i)),
      },
    ];
  }

  // 2) 预算类小节
  if (BUDGET_TITLE_RE.test(title) && listItems.length) {
    return [
      {
        icon: 'chart',
        title,
        ...(leadText ? { desc: leadText } : {}),
        kind: 'budget',
        budget: parseBudget(listItems),
      },
    ];
  }

  // 3) 表格
  if (table) {
    return [
      {
        icon: 'grid',
        title: title || '明细',
        ...(leadText ? { desc: leadText } : {}),
        kind: 'table',
        table: { headers: table.rows[0], rows: table.rows.slice(1) },
      },
    ];
  }

  // 4) 列表：时间线 / 卡片 / 清单
  if (listItems.length) {
    const ordered = blocks.some((b) => b.type === 'ol');
    const timeLike = listItems.filter((raw) => TIME_RE.test(stripMd(raw))).length;
    const timelineish =
      TIMELINE_TITLE_RE.test(title) || ordered || timeLike >= Math.ceil(listItems.length * 0.5);

    if (timelineish) {
      return [
        {
          icon: 'calendar',
          title: title || '步骤',
          ...(leadText ? { desc: leadText } : {}),
          kind: 'timeline',
          nodes: listToItems(listItems).map((it, i) => ({
            badge: String(i + 1),
            title: stripOrdinal(it.label),
            ...(it.time ? { meta: it.time } : {}),
          })),
        },
      ];
    }

    if (looksLikeCards(listItems) || CARDS_TITLE_RE.test(title)) {
      return [
        {
          icon: 'sparkle',
          title: title || '要点',
          ...(leadText ? { desc: leadText } : {}),
          kind: 'cards',
          cards: listItems.map((raw) => {
            const { emoji, rest } = splitEmoji(raw);
            const td = splitTitleDesc(raw);
            if (td) return { ...(emoji ? { emoji } : {}), title: td.title, desc: td.desc };
            const text = stripMd(rest);
            const idx = text.search(/[，,。；;：:]/);
            if (idx > 0 && idx <= 20) {
              return {
                ...(emoji ? { emoji } : {}),
                title: text.slice(0, idx).trim(),
                desc: text.slice(idx + 1).trim(),
              };
            }
            return { ...(emoji ? { emoji } : {}), title: text.slice(0, 18), desc: text.slice(18) || text };
          }),
        },
      ];
    }

    return [
      {
        icon: 'check',
        title: title || '清单',
        ...(leadText ? { desc: leadText } : {}),
        kind: 'list',
        list: [{ items: listItems.map((x) => stripMd(x)) }],
      },
    ];
  }

  // 5) 纯文本
  const fallbackText = [leadText, tableToText(leadTable)].filter(Boolean).join(' ');
  return [
    {
      icon: 'type',
      title: title || '说明',
      kind: 'text',
      text: fallbackText || '（本节暂无内容）',
    },
  ];
}

/** 末尾注意事项类小节 → PlanTipGroup[] */
function sectionToTipGroups(sec) {
  const groups = [];
  const { groups: h3Groups, leading } = groupByH3(sec.blocks);
  if (h3Groups.length) {
    for (const g of h3Groups) {
      const { emoji, rest } = splitEmoji(g.title);
      const items = flattenList(g.blocks).map((x) => stripMd(x));
      const paragraphs = g.blocks.filter((b) => b.type === 'p' || b.type === 'quote').map((b) => b.text);
      const all = [...items, ...paragraphs];
      if (all.length) groups.push({ icon: emoji || '📌', title: rest || '提醒', items: all });
    }
    // h3 之前的内容也别丢
    const leadItems = [
      ...flattenList(leading).map((x) => stripMd(x)),
      ...leading.filter((b) => b.type === 'p' || b.type === 'quote').map((b) => b.text),
    ];
    if (leadItems.length) {
      groups.unshift({ icon: '📌', title: sec.title || '提醒', items: leadItems });
    }
    return groups;
  }
  const items = flattenList(sec.blocks).map((x) => stripMd(x));
  const paragraphs = sec.blocks.filter((b) => b.type === 'p' || b.type === 'quote').map((b) => b.text);
  const all = [...items, ...paragraphs];
  if (all.length) groups.push({ icon: '📌', title: sec.title || '提醒', items: all });
  return groups;
}

/** 取第一句（尽量不在词中间截断） */
function firstSentence(s, max = 60) {
  const t = String(s || '').trim();
  if (!t) return '';
  const m = /^[^。！？!?；;]{4,}/.exec(t);
  const cand = (m ? m[0] : t).trim();
  if (cand.length <= max) return cand;
  return cand.slice(0, max).replace(/[，,、：:\s]+$/, '') + '…';
}

/* ---------------- meta / tags / 分类 ---------------- */

function extractMeta(fullText) {
  const meta = [];
  const push = (label, value) => {
    if (!value || meta.some((m) => m.label === label)) return;
    meta.push({ label, value: String(value).slice(0, 24) });
  };

  const range = /(\d{1,2}\s*[.\-/]\s*\d{1,2})\s*[–\-~至到]\s*(\d{1,2}\s*[.\-/]\s*\d{1,2})/.exec(fullText);
  if (range) push('日期', `${range[1]} – ${range[2]}`);
  else {
    const single = /(\d{1,2}\s*月\s*\d{1,2}\s*日)/.exec(fullText);
    if (single) push('日期', single[1]);
  }

  const dn = /([零一二两三四五六七八九十\d]{1,3})\s*天\s*([零一二两三四五六七八九十\d]{1,3})\s*晚/.exec(fullText);
  if (dn) {
    const a = cnToNumber(dn[1]);
    const b = cnToNumber(dn[2]);
    if (a && b) push('时长', `${a} 天 ${b} 晚`);
  } else {
    const d = /([零一二两三四五六七八九十\d]{1,3})\s*(?:天|日)(?!\s*晚)/.exec(fullText);
    const dNum = d ? cnToNumber(d[1]) : null;
    if (dNum) push('时长', `${dNum} 天`);
    else {
      const hr = /(\d+(?:\.\d+)?\s*[~–\-]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:小时|h)\b/i.exec(fullText);
      if (hr) push('耗时', `${hr[1]} 小时`);
    }
  }

  const people = /(\d+)\s*人/.exec(fullText);
  if (people) push('出行', `${people[1]} 人`);

  const money = /(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/.exec(fullText);
  if (money) push('预算', `¥${money[1]}`);
  else {
    const yuan = /([\d,]+(?:\.\d+)?)\s*元/.exec(fullText);
    if (yuan) push('预算', `¥${yuan[1]}`);
  }

  const count = /([零一二两三四五六七八九十\d]{1,3})\s*(道|个|款|项|件|台|张|套|种)\s*([\u4e00-\u9fa5]{0,4})/.exec(fullText);
  if (count) {
    const n = cnToNumber(count[1]);
    if (n && n > 1) push('数量', `${n} ${count[3] ? count[3].slice(0, 2) : count[2]}`.trim());
  }

  const difficulty = /(新手友好|入门|简单|零基础|进阶|高难度)/.exec(fullText);
  if (difficulty) push('难度', difficulty[1]);

  return meta.slice(0, 4);
}

const TAG_POOL = [
  '音乐节', '看海', '古城', '自驾', '徒步', '露营', '美食', '摄影', '攻略', '省钱',
  '装机', '显卡', 'CPU', '主板', '内存', '固态', '性价比', '升级',
  'MOD', '整合包', '联机', '单机', '沙盒', '肉鸽', '策略',
  '减脂', '增肌', '力量训练', '有氧', '饮食', '睡眠', '习惯',
  '家常菜', '电饭煲', '快手菜', '两人份', '新手友好', '汤',
];

function extractTags(title, fullText, sections) {
  const hay = `${title} ${fullText}`.toLowerCase();
  const hits = TAG_POOL.filter((k) => hay.includes(k.toLowerCase()));
  if (hits.length) return hits.slice(0, 3);
  const fromSections = sections
    .map((s) => s.title)
    .filter((t) => t && t.length <= 6 && !TIP_TITLE_RE.test(t) && !BUDGET_TITLE_RE.test(t));
  if (fromSections.length) return fromSections.slice(0, 3);
  return [];
}

function guessCategory(fullText) {
  const hay = String(fullText).toLowerCase();
  let best = { cat: 'life', score: 0 };
  for (const key of CATEGORY_KEYS) {
    let score = 0;
    for (const w of CATEGORY_PRESETS[key].words) {
      if (hay.includes(w.toLowerCase())) score += 1;
    }
    if (score > best.score) best = { cat: key, score };
  }
  return best.cat;
}

/* ---------------- 主入口 ---------------- */

function slugify(title, fallback) {
  const ascii = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return ascii || fallback;
}

/**
 * 解析计划文档
 * @param {string} raw 文件内容
 * @param {string} filename 原文件名（用于兜底标题与判断格式）
 * @param {object} [overrides] 允许调用方指定 id / category 等
 * @returns {object} Plan 结构草稿
 */
function parsePlanDocument(raw, filename = 'plan.md', overrides = {}) {
  const isHtml = /\.html?$/i.test(filename) || /^\s*<(!doctype|html|body|div|section|article|h1)/i.test(raw);
  const md = isHtml ? htmlToMarkdown(raw) : String(raw);

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks = parseBlocks(lines);

  // 第一个 h1 作为标题
  const h1Index = blocks.findIndex((b) => b.type === 'heading' && b.level === 1);
  let title = '';
  if (h1Index >= 0) title = blocks[h1Index].text;

  const body = h1Index >= 0 ? blocks.slice(h1Index + 1) : blocks.slice();

  // 拆 ## 小节
  const rawSections = [];
  let cur = { title: '', blocks: [] };
  for (const b of body) {
    if (b.type === 'heading' && b.level === 2) {
      rawSections.push(cur);
      cur = { title: b.text, blocks: [] };
    } else {
      cur.blocks.push(b);
    }
  }
  rawSections.push(cur);

  // 前言：第一个空标题小节 → subtitle / summary
  const preamble = rawSections.shift();
  const preambleParas = preamble
    ? preamble.blocks.filter((b) => b.type === 'p' || b.type === 'quote').map((b) => b.text)
    : [];
  let subtitle = '';
  let summary = '';
  if (preambleParas.length) {
    subtitle = firstSentence(preambleParas[0], 44);
    summary = firstSentence(preambleParas.slice(1).join(' ') || preambleParas[0], 160);
  }

  // 注意事项 → tips
  // 规则：命中严格词（注意事项/必读/风险…）一定归 tips；
  //       命中宽松词（提醒/要点/建议…）只有出现在最后一个小节时才归 tips，
  //       否则保留为正文小节（如「煲汤关键提醒」这种主体内容）。
  const contentSections = [];
  const tips = [];
  const nonEmpty = rawSections.filter((sec) => sec.blocks.length || sec.title);
  nonEmpty.forEach((sec, i) => {
    const isLast = i === nonEmpty.length - 1;
    const toTip =
      TIP_TITLE_STRICT_RE.test(sec.title) || (isLast && TIP_TITLE_LOOSE_RE.test(sec.title));
    if (toTip) tips.push(...sectionToTipGroups(sec));
    else contentSections.push(sec);
  });

  const sections = contentSections.flatMap(sectionToPlanSection);

  // 没有前言 → 用第一个小节的描述兜底，避免副标题/摘要为空
  if (!subtitle || !summary) {
    const first = sections[0];
    const fallback = first ? first.desc || first.text || '' : '';
    if (!subtitle) subtitle = firstSentence(fallback, 44);
    if (!summary) summary = firstSentence(fallback, 160);
  }

  // 没有 h1 → 用文件名兜底
  if (!title) {
    title = stripMd(filename.replace(/\.(md|markdown|html?|txt)$/i, '').replace(/[-_]+/g, ' ')).slice(0, 60) || '未命名计划';
  }
  if (!subtitle) subtitle = summary.slice(0, 60) || title;
  if (!summary) summary = subtitle;

  const fullText = [title, subtitle, ...sections.map((s) => `${s.title} ${s.desc || ''} ${s.text || ''}`)].join('\n');
  const category = overrides.category || guessCategory(`${title}\n${subtitle}\n${md.slice(0, 1200)}`);
  const preset = CATEGORY_PRESETS[category] || CATEGORY_PRESETS.life;

  // 路线：旅行类若正文出现「A → B → C」形态，抽出来
  let route;
  if (category === 'travel') {
    const rm = /([\u4e00-\u9fa5A-Za-z]{2,8}(?:\s*[→➔➜\-–—]\s*[\u4e00-\u9fa5A-Za-z]{2,8}){1,6})/.exec(md);
    if (rm) {
      const parts = rm[1].split(/\s*[→➔➜\-–—]\s*/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 8) route = parts;
    }
  }

  const plan = {
    id: overrides.id || slugify(title, '') || '',
    title,
    subtitle,
    category,
    emoji: overrides.emoji || preset.emoji,
    gradient: overrides.gradient || preset.gradient,
    tags: extractTags(title, fullText, sections),
    summary,
    meta: extractMeta(`${title}\n${subtitle}\n${md}`),
    sections,
    tips,
  };
  if (route) plan.route = route;
  return plan;
}

module.exports = {
  parsePlanDocument,
  htmlToMarkdown,
  CATEGORY_PRESETS,
  CATEGORY_KEYS,
};
