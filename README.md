# MiniCode

Windows 64 位桌面应用，为 Claude Code CLI 提供图形化界面。

## 功能特性

- **stream-json 协议通信** — 通过 `--input-format stream-json --output-format stream-json` 与 Claude CLI 实时交互
- **ccswitch 集成** — 自动读取 `~/.cc-switch/cc-switch.db`，切换不同 API provider（OpenAI、Anthropic、小米 MiMo 等）
- **SQLite 对话存储** — 所有对话记录本地保存，支持搜索、置顶、删除
- **毛玻璃 UI** — `backdrop-filter: blur(20px)` + 半透明面板 + 渐变主题
- **工具审批** — 支持实时审批 Claude 的工具调用（Bash、文件操作等）

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Electron 33 |
| 前端 | React 18 + Vite |
| 状态管理 | Zustand |
| 数据库 | better-sqlite3 (SQLite) |
| 样式 | TailwindCSS |
| 打包 | electron-builder |

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包 Windows 安装程序
npm run build:win
```

## 打包产出物

- `release/MiniCode-1.0.0-win-x64.exe` — NSIS 安装程序
- `release/MiniCode-1.0.0-win-x64-portable.zip` — 便携版 ZIP

## 项目结构

```
minicode/
├── electron/           # Electron 主进程
│   ├── main.ts         # 入口 + 窗口管理
│   ├── preload.ts      # IPC 桥接
│   ├── cli-bridge.ts   # Claude CLI stream-json 子进程管理
│   ├── database.ts     # SQLite 对话存储
│   ├── ccswitch.ts     # ccswitch 配置读取
│   └── ipc-handlers.ts # IPC 通信处理
├── src/                # React 渲染进程
│   ├── components/     # UI 组件
│   ├── stores/         # 状态管理
│   └── lib/            # IPC 封装 + 类型定义
├── resources/          # 应用图标
└── electron-builder.yml
```

## 前置条件

- Node.js >= 18
- Claude Code CLI (`claude`) 已安装并可用
- ccswitch（可选）— 用于多 API provider 管理

## License

MIT
