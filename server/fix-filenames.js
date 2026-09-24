const fs = require('fs');
const path = require('path');

const UP = '/www/wwwroot/server/uploads';
const files = fs.readdirSync(UP);

console.log('=== 修复脚本 ===');
console.log('');

let fixed = 0;

files.forEach((name) => {
  // 只处理 jpg/png（svg 是好的）
  if (!name.endsWith('.jpg') && !name.endsWith('.png')) return;

  // 清洗：只保留 [a-z0-9._-] 半角 ASCII
  const ext = path.extname(name).toLowerCase();
  const base = name.slice(0, -ext.length);

  // 生成干净名字：把所有非半角 ASCII 的字符替换为半角
  // 策略：把非 a-z0-9._- 的字符都替换为 - 或去掉
  const cleanBase = Array.from(base)
    .map((c) => {
      const code = c.charCodeAt(0);
      if ((code >= 0x61 && code <= 0x7a) || // a-z
          (code >= 0x30 && code <= 0x39) || // 0-9
          c === '_' || c === '.') {
        return c;
      } else if (c === '-' || c.charCodeAt(0) === 0x2d) {
        return '-';
      } else {
        // 非半角字符 → 尝试转成半角（全角转半角）
        // 全角范围 U+FF01 ~ U+FF5E → 对应半角减 0xFEE0
        // 全角 '-' U+FF0D → 半角 '-' U+002D
        const half = String.fromCharCode(code - 0xFEE0);
        const halfCode = half.charCodeAt(0);
        if ((halfCode >= 0x61 && halfCode <= 0x7a) || // a-z
            (halfCode >= 0x30 && halfCode <= 0x39) || // 0-9
            half === '-' || half === '_' || half === '.') {
          return half;
        }
        // 还是不行 → 直接去掉
        return '';
      }
    })
    .filter(c => c !== '')
    .join('')
    // 合并连续的 -
    .replace(/-+/g, '-')
    // 去掉开头结尾的 -
    .replace(/^-|-$/g, '');

  // 如果清洗后变了，就重命名
  const newName = cleanBase + ext;

  if (name !== newName) {
    const oldPath = path.join(UP, name);
    const newPath = path.join(UP, newName);

    // 先备份 cp → rm → mv（防万一）
    try {
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
      console.log(`修复: [${name}] → [${newName}]`);
      fixed++;
    } catch (e) {
      console.log(`修复失败: [${name}] → ${e.message}`);
    }
  } else {
    console.log(`已是干净: [${name}]`);
  }
});

console.log('');
console.log(`共修复 ${fixed} 个文件`);
console.log('');
console.log('=== 验证修复后 ===');
const after = fs.readdirSync(UP);
after.forEach(name => {
  const p = path.join(UP, name);
  console.log(`[${name}] exists=${fs.existsSync(p)} size=${fs.existsSync(p) ? fs.statSync(p).size : 'N/A'}`);
});
