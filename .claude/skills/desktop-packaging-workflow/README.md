# Desktop Packaging Workflow

本目录曾预留为项目内 packaging skill，现已迁移到用户级 skill：

`C:\Users\yuki\.claude\skills\minicode-development\SKILL.md`

## 快速命令

- Windows x64: `desktop/scripts/build-windows-x64.ps1`
- Windows ARM64: `desktop/scripts/build-windows-arm64.ps1`
- Linux: 在 WSL 原生路径执行 `desktop/scripts/build-linux.sh`
- package-smoke: `bun run test:package-smoke --platform windows --package-kind release --artifacts-dir desktop/build-artifacts/windows-x64`
- 产物目录: `desktop/build-artifacts/<platform>/`（不入库）

正式发版见 `docs/desktop/10-release-auto-update.md`。
