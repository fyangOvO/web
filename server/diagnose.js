const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const UP = '/www/wwwroot/server/uploads';
const testFile = 'mttk1e9-rvzl9z.jpg';
const fullPath = path.join(UP, testFile);

console.log('=== 诊断脚本 ===');
console.log('');

// 1. fs 层测试
console.log('1. fs 层:');
console.log('   路径:', fullPath);
console.log('   existsSync:', fs.existsSync(fullPath));
console.log('   stat:', fs.existsSync(fullPath) ? fs.statSync(fullPath).size + ' bytes' : 'N/A');
console.log('   readFileSync:', fs.existsSync(fullPath) ? fs.readFileSync(fullPath).length + ' bytes' : 'FAIL');

// 2. 目录内容
console.log('');
console.log('2. 目录列表:');
const files = fs.readdirSync(UP);
console.log('   共', files.length, '个文件');
const jpgs = files.filter(f => f.endsWith('.jpg'));
console.log('   jpg:', jpgs);
const svgs = files.filter(f => f.endsWith('.svg'));
console.log('   svg:', svgs);

// 3. express 测试
const app = express();

// 手动读文件端点（绕过 express.static）
app.get('/manual', (req, res) => {
  if (fs.existsSync(fullPath)) {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    res.status(404).send('fs says no');
  }
});

app.use('/uploads', express.static(UP));
app.use((req, res) => res.status(404).send('EXPRESS_404'));

const server = app.listen(3006, () => {
  console.log('');
  console.log('3. HTTP 端点测试 (port 3006):');

  http.get('http://localhost:3006/manual', (r1) => {
    console.log('   /manual (手动读jpg):', r1.statusCode, r1.headers['content-type']);
    r1.resume();

    http.get('http://localhost:3006/uploads/' + testFile, (r2) => {
      console.log('   /uploads/xxx.jpg (express.static):', r2.statusCode, r2.headers['content-type']);
      r2.resume();

      http.get('http://localhost:3006/uploads/note-1.svg', (r3) => {
        console.log('   /uploads/note-1.svg (express.static):', r3.statusCode, r3.headers['content-type']);
        r3.resume();

        console.log('');
        console.log('4. express.static 内部日志 (server 启动信息):');
        console.log('   express.static root =', UP);
        console.log('');
        console.log('=== 完成 ===');
        server.close();
      });
    });
  });
});
