[README.md](https://github.com/user-attachments/files/32837331/README.md)
# 研发样品管理系统

一套面向研发团队的轻量级资源管理系统，用于统一管理样品、资产、工装和在制板卡，并提供用户审批、借用归还、数据看板以及 Excel 导入导出功能。

项目采用原生 HTML、CSS、JavaScript 与 Node.js，数据存储在 SQLite 单文件数据库中，适合在 Windows 内网或局域网环境中部署。

## 功能概览

### 仪表盘

- 展示样品总数、待归还样品、今日申请、报废样品和借用人数。
- 展示资产总数、工装总数和在制板卡数，点击卡片可进入对应管理页面。
- 使用 ECharts 展示样品、资产、工装和在制板卡的分类统计。

### 资源管理

- **样品管理**：新增、编辑、删除、批量删除、搜索、分页、Excel 导入导出。
- **资产管理**：维护资产档案，并支持借用、归还及审批流程。
- **工装管理**：维护工装档案，并支持借用、归还及审批流程。
- **在制板卡管理**：维护产品名称、项目型号、批次、序列号、状态、部门、负责人、配套整机、交接日期、生产流程卡和备注等信息。

### 借用和审批

- 普通用户可以提交资源借用和归还申请。
- 管理员可以在审批管理中批准或拒绝申请。
- 借用记录统一展示样品、资产、工装和在制板卡数据。
- 系统会限制重复借用以及删除存在未完成借用记录的资源。

### 用户和权限

- 新用户注册后需要管理员审核。
- 新注册用户名只允许使用中文汉字。
- 管理员可以管理用户、资源和审批。
- 普通用户主要使用查询、借用和归还功能。
- 已有的英文管理员账号仍可登录。

## 技术栈

| 类型 | 技术 |
| --- | --- |
| 前端 | 原生 HTML、CSS、JavaScript、Tailwind CSS |
| 图表 | ECharts |
| Excel | SheetJS（XLSX） |
| 图标 | Font Awesome |
| 后端 | Node.js、Express |
| 数据库 | SQLite、better-sqlite3 |
| 进程守护 | PM2（可选） |

所有主要前端依赖均保存在 `assets/` 中，可以在没有外网的局域网环境使用。

## 项目结构

```text
project/
├─ 研发样品管理系统.html       # 前端主页面
├─ server.js                   # Express 主服务及主要业务接口
├─ board-api.js                # 在制板卡 CRUD 接口
├─ board-lending-api.js        # 板卡借用、归还和审批接口
├─ sample_management.db        # SQLite 主数据库（不要上传真实业务数据）
├─ package.json                # 项目依赖和 npm 命令
├─ package-lock.json           # 依赖锁定文件
├─ assets/
│  ├─ boards.css               # 在制板卡页面样式
│  ├─ css/                     # 全局样式和本地 Tailwind 资源
│  ├─ fonts/                   # 字体资源
│  ├─ images/                  # 页面图片
│  └─ js/
│     ├─ boards.js             # 在制板卡前端功能
│     ├─ echarts.min.js        # 图表库
│     └─ xlsx.full.min.js      # Excel 处理库
├─ backups/                    # 数据库备份目录
├─ start_server_new.bat        # Windows 启动脚本
├─ auto_start_server.bat       # Windows 开机启动辅助脚本
├─ backup_database.bat         # 数据库备份脚本
├─ backup_restore.js           # 数据备份和恢复工具
└─ better-sqlite3离线安装指南.md
```

## 环境要求

- Node.js 20 或更高版本，推荐使用当前 LTS 版本。当前锁定的 `better-sqlite3` 需要 Node.js 20、22、23 或 24。
- npm。
- Windows、Linux 或 macOS。项目附带的 `.bat` 和 `.ps1` 脚本仅适用于 Windows。

`better-sqlite3` 包含原生模块。如果在离线 Windows 环境安装，请参考项目中的 `better-sqlite3离线安装指南.md`。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

开发时也可以使用自动重启模式：

```bash
npm run dev
```

Windows 用户可以直接双击 `start_server_new.bat`。启动窗口需要保持运行，关闭窗口会停止服务。

### 3. 打开系统

本机访问：

```text
http://localhost:3000/
```

局域网其他设备访问：

```text
http://服务器IP地址:3000/
```

服务监听 `0.0.0.0:3000`。如果其他设备无法访问，请检查 Windows 防火墙是否允许 TCP 3000 端口。

## 默认管理员

首次运行且数据库中没有 `admin` 用户时，系统会自动创建：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin` | 管理员 |

首次登录后请尽快修改密码。

## 数据库

系统使用项目根目录下的 `sample_management.db`。首次启动会自动创建缺少的数据表，并在空数据环境中加入少量演示数据。

主要数据表包括：

- `users`：用户和审核状态。
- `samples`、`borrowRecords`、`approvals`：样品及其借用审批数据。
- `assets`、`assetBorrowRecords`、`assetApprovals`：资产数据。
- `tooling`、`toolingBorrowRecords`、`toolingApprovals`：工装数据。
- `boards`、`boardBorrowRecords`、`boardApprovals`：在制板卡数据。

更新程序时不要覆盖生产环境的 `sample_management.db`。

## 备份与恢复

Windows 下可以运行：

```text
backup_database.bat
```

备份文件默认写入 `backups/`。恢复数据前应先停止 Node.js 服务，并保留当前数据库的额外副本。

`backup_restore.js` 还提供命令行备份、列表和导出等能力，具体命令可查看文件底部的命令处理逻辑。

## PM2 部署（可选）

服务器长期运行时可以使用 PM2：

```bash
npm install -g pm2
npm run pm2:start
npm run pm2:status
npm run pm2:logs
```

代码更新后执行：

```bash
npm run pm2:restart
```

## 板卡独立模块

在制板卡功能已经从 `server.js` 中拆分：

- `board-api.js` 注册板卡增删改查接口。
- `board-lending-api.js` 注册板卡借用、归还和审批接口。
- `assets/js/boards.js` 负责板卡页面交互。
- `assets/boards.css` 负责板卡页面样式。

修改板卡后端文件后必须重启 Node.js 服务。只修改 `boards.js` 或 `boards.css` 时通常刷新浏览器即可；遇到缓存时使用 `Ctrl+F5`。

## API 概览

| 模块 | 常用接口 |
| --- | --- |
| 登录注册 | `POST /api/login`、`POST /api/register` |
| 密码 | `POST /api/change-password`、`POST /api/reset-password` |
| 样品 | `/api/samples` |
| 样品借用 | `/api/borrow-records`、`/api/return-request` |
| 资产 | `/api/assets` |
| 资产借用 | `/api/asset-borrow-records`、`/api/asset-return-request` |
| 工装 | `/api/tooling` |
| 工装借用 | `/api/tooling-borrow-records`、`/api/tooling-return-request` |
| 板卡 | `/api/boards` |
| 板卡借用 | `/api/board-borrow-records`、`/api/board-return-request` |
| 用户 | `/api/users` |
| 仪表盘 | `GET /api/dashboard` |
| 服务信息 | `GET /api/server-info` |

## GitHub 上传前检查

本项目的数据库、备份和导出文件可能含有真实用户名、手机号及业务数据。上传公开仓库前，请确保排除：

```gitignore
node_modules/
*.db
*.db-shm
*.db-wal
backups/
backup_log.txt
local_data.json
*.zip
.env
```

仓库中建议仅保留代码和空数据库初始化逻辑。不要上传生产环境数据库、真实备份或包含敏感信息的截图。

## 当前安全限制

当前版本定位为可信局域网内部工具：

- 密码目前以明文形式存储。
- 登录状态保存在浏览器本地存储中。
- 部分接口使用请求中的用户 ID 进行权限识别。
- 默认使用 HTTP，没有内置 HTTPS。

请勿直接暴露到公网。若用于正式生产或公网环境，建议增加密码哈希、服务端会话或令牌认证、CSRF 防护、请求限流、操作审计和 HTTPS。

## 常见问题

### 页面显示 `Cannot GET`

请确认从项目根目录启动的是当前 `server.js`，并访问 `http://服务器IP:3000/`。可以通过 `/api/server-info` 检查正在运行的版本和项目目录。

### 板卡页面提示接口不存在

请确认以下文件位于项目根目录并重启服务：

```text
board-api.js
board-lending-api.js
```

同时确认 `server.js` 包含：

```js
const registerBoardApi = require('./board-api');
```

### 修改后浏览器仍显示旧页面

使用 `Ctrl+F5` 强制刷新。修改后端代码时还需要重启 Node.js 或 PM2 进程。

## License

项目的 `package.json` 当前声明为 ISC License。若公开发布，建议在仓库根目录补充正式的 `LICENSE` 文件。
