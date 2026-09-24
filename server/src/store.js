/**
 * 极简 JSON 文件存储。
 * 数据保存在 server/data/db.json，读写为同步操作，适合个人站点规模。
 * 需要更正式的持久化时，可平滑替换为 SQLite / MySQL，接口保持一致。
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`数据库文件不存在：${DB_FILE}`);
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDb(db) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function nextId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = { readDb, saveDb, nextId, DB_FILE };
