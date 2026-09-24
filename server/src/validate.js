/**
 * UGC 合规：字段校验 + 敏感词过滤（留言板 / 联系表单）。
 * 敏感词库仅为演示级最小集合，正式上线请接入专业词库或人工审核。
 */

const SENSITIVE = [
  '赌博', '博彩', '彩票代购', '色情', '代开发票', '办证刻章', '贷款秒批',
  '刷单', '兼职日结', '加微信', '加qq', '加QQ', '汇款', '中奖领取',
  '违禁品', '翻墙软件', '外挂', '刷钻',
];

function filterSensitive(text) {
  let out = String(text == null ? '' : text);
  for (const word of SENSITIVE) {
    if (out.includes(word)) {
      out = out.split(word).join('*'.repeat(word.length));
    }
  }
  return out;
}

function hasSensitive(text) {
  const t = String(text == null ? '' : text);
  return SENSITIVE.some((w) => t.includes(w));
}

function validateMessage(name, content) {
  if (!name || typeof name !== 'string') return '请填写昵称';
  const n = name.trim();
  if (n.length < 1 || n.length > 20) return '昵称长度需在 1-20 个字符之间';

  if (!content || typeof content !== 'string') return '请填写留言内容';
  const c = content.trim();
  if (c.length < 2 || c.length > 500) return '留言内容长度需在 2-500 个字符之间';

  return null;
}

function validateContact(name, email, message) {
  if (!name || typeof name !== 'string' || !name.trim()) return '请填写姓名';

  if (!email || typeof email !== 'string') return '请填写邮箱地址';
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return '请填写有效的邮箱地址';

  if (!message || typeof message !== 'string') return '请填写留言内容';
  const m = message.trim();
  if (m.length < 5) return '留言内容请不少于 5 个字符';
  if (m.length > 1000) return '留言内容请控制在 1000 字以内';

  return null;
}

module.exports = { SENSITIVE, filterSensitive, hasSensitive, validateMessage, validateContact };
