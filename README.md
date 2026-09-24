# 个人网站（Vue 3 + Node.js 全栈）

一个大气、有章法的个人网站：前台 Vue 3（最新版） + 后台 Node.js（Express），含博客、作品集、留言板、联系表单与隐藏后台管理页。UI 灵感参考 Inspira UI（极光背景、Spotlight 卡片、渐变流光文字、Bento 网格、打字机等），所有动效组件零第三方 UI 依赖，手写实现。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.5 + Vite 6 + TypeScript + Vue Router 4 + Tailwind CSS v4 + axios + lunar-javascript（农历）+ swiper（首页轮播） |
| 后端 | Node.js + Express 4 + CORS + nodemailer（可选：友链申请邮件通知） |
| 存储 | JSON 文件（`server/data/db.json`），改完刷新即生效，无需数据库 |

## 快速开始

```bash
# 1. 安装依赖（首次）
cd server && npm install
cd ../web && npm install

# 2. 启动后端（端口 3001）
cd server && npm start

# 3. 启动前端（端口 5173，开发模式已代理 /api → 3001）
cd web && npm run dev
```

打开 http://localhost:5173 即可访问。生产构建：`cd web && npm run build`（产物在 `web/dist`）。

## 目录结构

```
personal-site/
├── server/                 # Node.js 后端
│   ├── src/
│   │   ├── index.js        # Express 入口 + 全部 API（含图文上传与后台管理）
│   │   ├── store.js        # JSON 读写（readDb / saveDb / nextId）
│   │   └── validate.js     # 表单校验 + 敏感词过滤 + honeypot
│   ├── uploads/            # 图文笔记上传的图片（静态服务 /uploads）
│   └── data/db.json        # 站点全部内容（资料/技能/项目/文章/图文/留言/联系）
└── web/                    # Vue 3 前端
    └── src/
        ├── views/          # 9 个页面（Home/About/Projects/Blog/BlogPost/Notes/Guestbook/Contact/Privacy）+ Admin
        ├── components/
        │   ├── ui/         # 炫酷组件（Aurora/Spotlight/GradientText/Typewriter 等）
        │   ├── layout/     # 导航栏 / 页脚
        │   ├── NoteComposer.vue  # 发布图文弹窗（多图上传 + 内嵌登录）
        │   └── admin/      # 后台编辑器（文章/项目/正文块）
        ├── api/index.ts    # 全部 API 封装（含后台管理鉴权与图文上传）
        ├── router/index.ts # 路由（懒加载 + 每页 title）
        └── style.css       # 设计系统（glass/极光/渐变文字等）
```

## 页面

- **首页**：极光 Hero + 打字机标语 + 数据统计 + 技能 Bento + 精选项目 + 最新博客 + 留言引导
- **关于**：个人简介 + 技能 + 时间线 + 兴趣爱好
- **项目**：全部项目，按标签筛选
- **博客**：文章列表（标签筛选 + 分页），详情页支持图文混排、代码复制、上一篇/下一篇；右侧栏含**友链 + 日历**卡片
- **随笔**：标题列表式专栏，点击进入正文，标签筛选 + 上一篇/下一篇；与博客共用文章数据模型（`category` 区分 blog / essay），同样带右侧栏
- **文章详情**：结构化正文渲染（段落/标题/引用/提示框/代码块/列表），代码一键复制
- **图文**（小红书风格）：双列瀑布流 + 标签筛选 + 点赞 + 详情弹窗；「发布图文」弹窗支持多图上传（最多 9 张、首张为封面）、标题、正文、话题标签，未登录时内嵌密码认证；作者登录后可在详情页直接**编辑**笔记（增删图片、改文案）；每篇笔记支持**评论**（昵称 + 内容，校验/敏感词打码/honeypot），后台可管理评论
- **留言板**：访客留言（昵称 + 内容），实时落盘
- **网址导航**（/nav，hao360 风格）：按分类展示常用站点卡片（favicon 图标 + 名称 + 一句话简介），支持站内搜索过滤、分类 tab 切换；数据来自 `db.json` 的 `navCategories` + `navLinks`，接口 GET `/api/nav-links`；侧边栏友链卡「更多」与导航栏「导航」均可进入
- **地图弹层**：联系页「坐标」行可点击，弹出高德底图（Leaflet + 高德瓦片，无需 key）展示位置标记，支持「在高德中打开」；坐标/名称在 `db.json` 的 `map` 字段配置（lat/lng/name/address/zoom），接口 GET `/api/map`
- **联系**：联系表单（昵称/邮箱/留言），邮箱校验
- **隐私政策**：7 段合规正文
- **后台管理**（隐藏入口 `/admin`，导航栏不显示）

## 后台管理

地址：`http://localhost:5173/admin`（不在导航栏显示，直接输入 URL 访问）。

| 能力 | 说明 |
|---|---|
| 文章管理 | 新增 / 编辑 / 删除；可选「博客 / 随笔」栏目并按栏目筛选；正文可视化块编辑（段落/标题/引用/提示框/代码/列表，可上下移动） |
| 项目管理 | 新增 / 编辑 / 删除；封面渐变、图标、精选开关 |
| 图文管理 | 隐藏 / 显示 / 删除（发布、编辑在「图文」专栏页完成） |
| 评论管理 | 显示所属笔记、隐藏 / 显示 / 删除 |
| 友链管理 | 新增 / 编辑 / 删除；隐藏（待审核）/ 显示；前台申请默认进入待审核 |
| 留言管理 | 隐藏 / 显示 / 删除 |
| 联系消息 | 标记已读 / 删除 |
| 资料设置 | 姓名、职位、简介、标语、社交链接、统计等 |

**登录密码**：默认 `admin123`。正式使用前务必设置环境变量修改：

```bash
# Windows PowerShell（启动前设置）
$env:ADMIN_PASSWORD = "你的密码"
cd server && npm start
```

- **会话持久化**：token 写入 `db.json` 的 `adminTokens`，**后端重启不退出登录**，有效期 7 天；「退出登录」调 `POST /api/admin/logout` 双向清除（后端不可达时也照常本地登出）。
- 所有修改立即写入 `server/data/db.json`，刷新前台页面即生效。
- 管理接口路径 `/api/admin/*`，未登录一律 401；登录接口有密码错误提示，鉴权使用常量时间比较。

## API 一览

公开接口（GET /api/profile、/skills、/timeline、/projects、/posts（?category=blog|essay&tag=&limit=）、/posts/:id、/friend-links、/stats、/messages、/notes、/notes/:id、/notes/:id/comments；POST /api/messages、/contact、/notes/:id/like、/notes/:id/comments、/friend-links/apply）；管理接口（/api/admin/login、/logout、/me、/posts、/projects、/notes、/comments、/friend-links、/messages、/contact-messages、/profile、/skills、/timeline，均需 Bearer Token；图文图片上传 /api/admin/notes/upload，multipart 字段名 images，最多 9 张、单张 ≤ 8MB，仅 JPG/PNG/WebP/GIF）。

## 首页轮播与动态背景

- **精选轮播**（`web/src/components/home/HeroCarousel.vue`）：**页面最顶部的全宽大图轮播**（无左右留白，铺满整个视口宽度），高度 384px（移动）/ 512px（桌面），文案内部对齐内容容器。自动聚合最新博客 3 篇 + 最新图文 2 条 + 精选项目 2 个（`/api/posts`、`/api/notes`、`/api/projects`）。特效：**creative 3D 层叠切换**（上一张缩小左移、下一张从右切入）、内容逐项错峰入场（徽章→标题→摘要→按钮）、背景 **Ken Burns 慢推**（8s 缓动缩放）、5.6s 自动播放（悬停暂停）、图文条目封面全幅背景、整卡点击跳转。**指示条置于轮播图内底部**（白色圆角条，可点击），图下不再留白，轮播底边叠加渐变过渡与 Hero 无缝衔接。
- **全页面动态虚化背景**（`web/src/components/ui/AnimatedBackground.vue`）：全局固定背景层（**所有页面、任意滚动位置生效**），**全局渐变底色铺满整个视口** + 8 个大尺寸渐变光斑铺满四角/边缘/中央（`blur(115-140px)` 虚化并 20-30s 缓慢漂移）+ 网格纹理；暗色模式自动切换深色渐变与降透明度，尊重系统「减少动态效果」。页面半透明玻璃卡片（`.glass`，白 62% / 暗 42% 透明度 + blur）透出光斑形成全站虚化背景，无割裂空白区。

- 博客、随笔列表页在宽屏（≥1024px）右侧显示 sticky 侧边栏（移动端折叠到列表下方），包含三张卡片：
  - **友情链接**：公开仅展示 `visible` 的友链；数据来自 `server/data/db.json` 的 `friendLinks`（name / url / desc / visible / date），前台每项显示**站点图标**（自动抓取 favicon，失败回退站点首字母）。**申请入口**：卡片底部「申请友链」表单（名称/网址/简介 + honeypot + 校验），提交后写入 `visible:false`，后台「友链」面板审核后显示。管理接口：GET/POST `/api/admin/friend-links`、PATCH/DELETE `/api/admin/friend-links/:id`；申请接口：POST `/api/friend-links/apply`。**申请邮件通知**：在 `db.json` 的 `mailer` 字段配置 SMTP 后，新申请会自动发信给管理员（未配置则静默跳过）：
    ```json
    "mailer": {
      "host": "smtp.qq.com", "port": 465, "secure": true,
      "user": "你的邮箱", "pass": "授权码",
      "from": "你的邮箱", "to": "接收通知的邮箱"
    }
    ```
  - **日历**：当月月历（周一开始，可切换上/下月），今日高亮，每个格子显示**农历**（基于 lunar-javascript 库）与节日（春节/中秋/元宵/端午等自动识别），底部「距离中秋节」倒计时。
  - **站点统计**：`GET /api/stats` 返回文章数（博客+随笔+图文）、本站总字数、建站日期（`db.json` 的 `siteStartDate`，默认 2026-01-01，可改）、最近更新时间（取文章/图文最大日期）；卡片顶部展示**时间进度紫条**（今日/本周/本月/本年实时占比，参考博客园侧边栏样式）。

## 侧边栏（友链 + 日历 + 站点统计）

- 博客、随笔列表页在宽屏（≥1024px）右侧显示 sticky 侧边栏（移动端折叠到列表下方），包含三张卡片：
  - **友情链接**：公开仅展示 `visible` 的友链；数据来自 `server/data/db.json` 的 `friendLinks`（name / url / desc / visible / date），前台每项显示**站点图标**（自动抓取 favicon，失败回退站点首字母）。**申请入口**：卡片底部「申请友链」表单（名称/网址/简介 + honeypot + 校验），提交后写入 `visible:false`，后台「友链」面板审核后显示。管理接口：GET/POST `/api/admin/friend-links`、PATCH/DELETE `/api/admin/friend-links/:id`；申请接口：POST `/api/friend-links/apply`。**申请邮件通知**：在 `db.json` 的 `mailer` 字段配置 SMTP 后，新申请会自动发信给管理员（未配置则静默跳过）：
    ```json
    "mailer": {
      "host": "smtp.qq.com", "port": 465, "secure": true,
      "user": "你的邮箱", "pass": "授权码",
      "from": "你的邮箱", "to": "接收通知的邮箱"
    }
    ```
  - **日历**：当月月历（周一开始，可切换上/下月），今日高亮，每个格子显示**农历**（基于 lunar-javascript 库）与节日（春节/中秋/元宵/端午等自动识别），底部「距离中秋节」倒计时。
  - **站点统计**：`GET /api/stats` 返回文章数（博客+随笔+图文）、本站总字数、建站日期（`db.json` 的 `siteStartDate`，默认 2026-01-01，可改）、最近更新时间（取文章/图文最大日期）；卡片顶部展示**时间进度紫条**（今日/本周/本月/本年实时占比，参考博客园侧边栏样式）。

## 随笔

- 随笔是与博客并列的独立栏目，导航「随笔」进入；列表为**标题列表**形式（标题 + 摘要 + 日期 + 标签）。
- 详情页底部有「上一篇 / 下一篇」导航，按日期排序、仅限同栏目内。
- 随笔与博客共用文章数据：`posts.category`（`blog` / `essay`）区分栏目。后台「文章管理」新增/编辑可选栏目并按栏目筛选；`GET /api/posts?category=essay` 只返回随笔，`?category=blog` 只返回博客，不带参数返回全部。

## 图文笔记

- 发布入口：导航「图文」→ 右上角「发布图文」；未登录时弹窗内输入管理密码即可发布（发布需要后台权限，防垃圾）。
- 编辑入口：后台已登录状态下，打开某篇笔记详情 → 右上角「编辑」；可增删图片、改标题/正文/标签，保存即生效。
- 评论：详情页底部评论区，访客可发表（校验 + 敏感词打码 + honeypot）；后台「评论」面板可隐藏 / 显示 / 删除。
- 图片存储：`server/uploads/`，通过 `/uploads` 静态路径访问（开发环境 Vite 已代理）。
- 点赞：公开接口，客户端用 localStorage 记录已赞去重，可取消。

## 修改内容

- 全部内容在 `server/data/db.json`：`profile`（基本资料/统计/社交）、`skills`、`projects`、`posts`（含结构化 `blocks`）、`notes`（图文）、`timeline`、`messages`、`contactMessages`。
- 更推荐：直接用后台管理页操作，无需手改 JSON。

## 部署提示

- 前端构建产物 `web/dist` 可用任意静态托管（Nginx / Gitee Pages / Vercel 等），注意把 `/api` 与 `/uploads` 反向代理到 Node 服务的 3001 端口。
- 后端可部署到 Node 环境（VPS / Render / 宝塔等），`ADMIN_PASSWORD` 务必改为环境变量注入。
- `server/uploads/` 需保证可写且持久化（图文图片不会进 db.json）。
- 页脚 ICP 备案号为占位符，上线前替换为真实备案号（未备案网站不可使用大陆服务器）。
