# XZZDPRO

XZZDPRO 是一个基于 Plasmo 的浏览器扩展，用于优化浙江大学课程平台（`courses.zju.edu.cn`）的页面体验，并集成学习助理能力。

## 功能概览

- 页面美化与统一布局：主页、课程列表、课程详情等页面统一为扩展 UI 风格
- 侧边栏增强：支持折叠、宽度拖拽、状态持久化
- 主页组件支持拖拽分栏调整（左右与上下布局）
- 学习助理（Air 页面）：
	- 对话问答（支持多模型提供商）
	- 课程上下文注入与课程切换
	- 资料选择与附件处理（含 PDF 相关能力）
	- 历史记录管理
- 后台上传通道：通过 background worker 处理上传流程（用于绕过内容脚本中的跨域限制场景）

## 技术栈

- `Plasmo`（浏览器扩展框架）
- `React 18` + `TypeScript`
- `Tailwind CSS` + `shadcn/ui`
- `@plasmohq/storage` / `@plasmohq/messaging`
- `LangChain` 相关 provider SDK（OpenAI / Anthropic / Gemini / OpenRouter / DeepSeek 等）

## 部署方法

### 1. 本地开发部署（Chrome / Edge）

1) 安装依赖

```bash
pnpm install
```

2) 启动开发构建

```bash
pnpm dev
```

3) 浏览器加载扩展

- 打开 `chrome://extensions/`（Edge 为 `edge://extensions/`）
- 开启“开发者模式”
- 点击“加载已解压的扩展程序”
- 选择项目中的 `build/chrome-mv3-dev` 目录

4) 更新代码后

- 保持 `pnpm dev` 运行
- 在扩展管理页点击“刷新”即可看到最新效果

## 项目结构（核心目录）

```text
src/
	assistant/      学习助理核心逻辑（provider、上下文、聊天）
	background/     扩展后台脚本（上传等）
	components/     React 组件与 UI 组件
	contents/       各页面内容脚本入口
	lib/            页面 beautifier 与通用逻辑
	styles/         全局与页面样式
	types/          类型定义
build/
	chrome-mv3-dev/ 开发构建产物
	chrome-mv3-prod/生产构建产物
```