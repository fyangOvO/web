const fs = require('fs');
const path = require('path');

const UP = '/www/wwwroot/server/uploads';
const files = fs.readdirSync(UP);
console.log('=== 字节级诊断 ===');
console.log('');

// 逐个检查每个 jpg 的文件名真实字节
const jpgs = files.filter(f => f.endsWith('.jpg'));
console.log('所有 jpg 文件（readdirSync 读取）:');
jpgs.forEach((name, i) => {
  console.log('');
  console.log(`[${i}] 原始名: [${name}]`);
  console.log('      字节:', Buffer.from(name).toString('hex'));
  console.log('      字符码:', Array.from(name).map(c => c.charCodeAt(0)));
  
  // 手动用 fs.existsSync 测
  const fullPath = path.join(UP, name);
  console.log('      path.join 后:', fullPath);
  console.log('      existsSync:', fs.existsSync(fullPath));
  
  // 用 stat 测是否真的存在
  try {
    const stat = fs.statSync(fullPath);
    console.log('      statSync:', stat.size, 'bytes');
  } catch (e) {
    console.log('      statSync 失败:', e.code, e.message);
  }
});

// 对比：手动用已知干净的文件名去试
console.log('');
console.log('=== 用"干净"文件名硬编码测试 ===');
const cleanNames = ['mttk1e9-rvzl9z.jpg', 'mttk1v1-x11zef.jpg', 'mttk1yk9-k3ku.jpg'];
cleanNames.forEach(name => {
  const p = path.join(UP, name);
  console.log(`[${name}]`);
  console.log('  字节:', Buffer.from(name).toString('hex'));
  console.log('  existsSync:', fs.existsSync(p));
  try {
    console.log('  statSync:', fs.statSync(p).size, 'bytes');
  } catch(e) {
    console.log('  statSync 失败:', e.code);
  }
});

// 终极测试：用 for...of 遍历每个 char，找哪个不是 ASCII
console.log('');
console.log('=== 哪个字符是"假"的？===');
jpgs.forEach(name => {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code > 127) {
      console.log(`文件名 [${name}] 第 ${i} 位: char="${name[i]}" code=${code} hex=0x${code.toString(16)} (非 ASCII！)`);
    }
  }
});
