const fs = require('fs');
const path = require('path');

const UP = '/www/wwwroot/server/uploads';
const DB_PATH = '/www/wwwroot/server/data/db.json';

console.log('=== 一键修复：文件名 + db.json ===');
console.log('');

// 1. 修复 uploads 目录里的脏文件名
const files = fs.readdirSync(UP);
const renameMap = {}; // { 旧名: 新名 }
let fixedFiles = 0;

files.forEach((name) => {
  if (!name.endsWith('.jpg') && !name.endsWith('.png')) return;

  const ext = path.extname(name).toLowerCase();
  const base = name.slice(0, -ext.length);

  // 清洗：非半角 ASCII 的字符 → 转半角或去掉
  const cleanBase = Array.from(base)
    .map((c) => {
      const code = c.charCodeAt(0);
      if ((code >= 0x61 && code <= 0x7a) ||
          (code >= 0x30 && code <= 0x39) ||
          c === '_' || c === '.' || c === '-') {
        return c;
      }
      // 全角 → 半角
      const half = String.fromCharCode(code - 0xFEE0);
      const halfCode = half.charCodeAt(0);
      if ((halfCode >= 0x61 && halfCode <= 0x7a) ||
          (halfCode >= 0x30 && halfCode <= 0x39) ||
          half === '-' || half === '_' || half === '.') {
        return half;
      }
      return '';
    })
    .filter(c => c !== '')
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const newName = cleanBase + ext;

  if (name !== newName) {
    try {
      const oldPath = path.join(UP, name);
      const newPath = path.join(UP, newName);
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
      renameMap[name] = newName;
      console.log(`📁 重命名: [${name}] → [${newName}]`);
      fixedFiles++;
    } catch (e) {
      console.log(`❌ 重命名失败: ${e.message}`);
    }
  }
});

console.log(`\n共修复 ${fixedFiles} 个脏文件名\n`);

// 2. 同步更新 db.json 里的 URL
if (Object.keys(renameMap).length === 0) {
  console.log('没有脏文件名需要修复，db.json 跳过');
  process.exit(0);
}

let dbRaw = fs.readFileSync(DB_PATH, 'utf8');
let changed = 0;

Object.entries(renameMap).forEach(([oldName, newName]) => {
  const oldUrl = '/uploads/' + oldName;
  const newUrl = '/uploads/' + newName;

  // 先统计出现了多少次
  const matches = dbRaw.split(oldUrl).length - 1;
  if (matches > 0) {
    dbRaw = dbRaw.split(oldUrl).join(newUrl);
    console.log(`📝 db.json: ${oldUrl} → ${newUrl}  (${matches} 处)`);
    changed += matches;
  }
});

if (changed > 0) {
  // 备份原文件
  fs.copyFileSync(DB_PATH, DB_PATH + '.bak');
  // 写入更新
  fs.writeFileSync(DB_PATH, dbRaw, 'utf8');
  console.log(`\n✅ db.json 更新完成，共 ${changed} 处 URL 已替换（原文件备份为 db.json.bak）`);
} else {
  console.log('db.json 里没找到对应的旧 URL，跳过');
}

// 3. 验证修复
console.log('\n=== 验证修复后 ===');
const afterFiles = fs.readdirSync(UP);
const jpgList = afterFiles.filter(f => f.endsWith('.jpg'));
console.log('剩余 jpg 文件:');
jpgList.forEach(f => {
  const fullPath = path.join(UP, f);
  console.log(`  [${f}]  exists=${fs.existsSync(fullPath)}  size=${fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 'N/A'}`);
});

// 4. 后端已经在跑，应该能立刻读到新文件名
console.log('\n=== 修复完成，记得 PM2 不需要重启 ===');
console.log('express.static 会实时读磁盘新文件名');
