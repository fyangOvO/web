# ============================================
# 个人网站一键部署脚本
# 用法：在 PowerShell 里直接跑 .\deploy.ps1
# ============================================

$SERVER = "root@8.133.210.172"
$REMOTE = "/root/personal-site"
$LOCAL  = "d:\YFY\personal-site\personal-site"

Write-Host "=== 第 1/4 步：前端打包 ===" -ForegroundColor Cyan
Push-Location "$LOCAL\web"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "打包失败！" -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location
Write-Host "✅ 打包完成" -ForegroundColor Green

Write-Host "`n=== 第 2/4 步：上传前端 dist ===" -ForegroundColor Cyan
scp -r "$LOCAL\web\dist\*" "${SERVER}:${REMOTE}/web/dist/"
Write-Host "✅ 前端已上传" -ForegroundColor Green

Write-Host "`n=== 第 3/4 步：上传后端 index.js + db.json ===" -ForegroundColor Cyan
scp "$LOCAL\server\src\index.js" "${SERVER}:${REMOTE}/server/src/"
scp "$LOCAL\server\data\db.json"  "${SERVER}:${REMOTE}/server/data/"
Write-Host "✅ 后端代码已上传" -ForegroundColor Green

Write-Host "`n=== 第 4/4 步：服务器创建 uploads 目录 + 重启后端 + 验证 ===" -ForegroundColor Cyan
$remoteCmd = @"
mkdir -p $REMOTE/server/uploads && chmod -R 755 $REMOTE/server/uploads
cd $REMOTE/server
# 尝试 pm2，不行就直接 kill + nohup
if command -v pm2 &>/dev/null; then
  pm2 restart personal-site-backend 2>/dev/null || pm2 start src/index.js --name personal-site-backend
else
  kill `$(lsof -ti:3001) 2>/dev/null
  nohup node src/index.js > server.log 2>&1 &
fi
sleep 2
echo '--- 验证 /api/settings ---'
curl -s http://localhost:3001/api/settings | head -c 200; echo
echo '--- 验证 /uploads/ ---'
curl -s -o /dev/null -w '/uploads/: %{http_code}\n' http://localhost:3001/uploads/
echo '--- nginx /api/settings ---'
curl -s http://8.133.210.172/api/settings | head -c 200; echo
"@
ssh $SERVER $remoteCmd

Write-Host "`n=== 部署完成 ===" -ForegroundColor Green
Write-Host "浏览器打开 http://8.133.210.172 查看效果"
Write-Host "如果 nginx 还没代理 /uploads 和 /api，需要手动配一下"
