# Cloudflare Pages AI 助手 (基于 Pages Functions + KV)

## 🌟 项目概述

本项目旨在构建一个高性能、可灵活配置的 AI 聊天助手。项目采用 Cloudflare Pages Functions 作为无服务器后端，结合 Cloudflare Workers KV 进行持久化配置存储，实现了前后端分离的现代化架构。前端风格模仿了 Grok AI 的极简深色调设计。

## ✨ 核心特性

* **无服务器架构：** 完全基于 Cloudflare Pages Functions 和 KV 构建，实现高可用性和低运维成本。
* **开放式聊天：** 主聊天界面对所有用户开放，无需登录即可进行交互。
* **管理员保护：** 配置管理 API (`/api/config`) 受到 **Basic Auth** 保护，仅允许具有正确凭证的管理员进行访问和修改。
* **持久化配置：** 使用 Cloudflare Workers KV 存储 AI 助手的关键配置（名称、API Key、模型、风格指令和 **AI API Endpoint**）。
* **上下文关联：** 聊天接口通过传递完整的对话历史记录，确保两天内容能够关联上下文。
* **新建对话：** 支持一键清除历史记录，重新开始新的上下文关联对话。

## 🏛️ 项目架构与文件功能

本项目采用标准 Pages Functions 结构：

| 路径/文件 | 类型 | 核心职责 |
| :--- | :--- | :--- |
| **`public/`** | 静态文件 | 托管 HTML、CSS 和 JavaScript 文件，负责 Grok 风格界面渲染及前端交互逻辑。 |
| **`functions/`** | Functions 根目录 | 包含后端 API 路由逻辑。 |
| ↳ `_middleware.js` | 中间件 | 实现身份验证逻辑，**仅对 `/api/config` 路径生效**。 |
| ↳ `api/login.js` | API Endpoint | 验证管理员用户名和密码，颁发会话凭证。 |
| ↳ `api/config.js` | API Endpoint | 负责配置信息的 **CRUD** 操作，使用 KV 存储配置。 |
| ↳ `api/chat.js` | API Endpoint | 对外开放的聊天接口，读取 KV 配置并调用外部 AI 模型 API。 |

## 🚀 部署要求

### 1. 资源准备

在 Cloudflare 仪表板中，您需要：

1.  **创建一个 KV 命名空间**：
    * 推荐命名为 `AI_CONFIG_KV`。

### 2. Cloudflare Pages 配置

在连接 GitHub 仓库创建 Pages 项目时，请确保以下设置正确：

| 配置项 | 值/说明 | 备注 |
| :--- | :--- | :--- |
| **构建命令 (Build command)** | **留空** | 项目为纯前端和 Functions，无需构建步骤。 |
| **构建输出目录 (Build output directory)** | `public` | 静态文件和入口文件位于此目录。 |

### 3. 环境变量 (Environment Variables)

必须配置以下环境变量，用于保护管理员登录。请在 Cloudflare Pages 设置的 **环境变量** 部分配置：

| 变量名称 | 作用 | 必须性 |
| :--- | :--- | :--- |
| `ADMIN_USERNAME` | 管理员用户名 | 必须 |
| `ADMIN_PASSWORD` | 管理员密码 | 必须 |

### 4. KV 绑定 (KV Namespace Bindings)

必须将 KV 命名空间绑定到 Functions 上下文。请在 Cloudflare Pages 设置的 **KV 命名空间绑定** 部分配置：

* **变量名称 (Variable name):** `AI_CONFIG_KV`
* **KV 命名空间 (KV Namespace):** 选择您在资源准备阶段创建的 `AI_CONFIG_KV`。

## 🔧 初次配置与使用

项目部署成功后，请按以下步骤完成 AI 助手的激活：

1.  **访问项目 URL：** 部署完成后，访问您的 Cloudflare Pages URL。
2.  **进入配置界面：** 点击左侧导航栏的 **⚙️ 配置管理** 按钮。
3.  **管理员登录：** 输入您在 **步骤 3** 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 进行登录。
4.  **填写 AI 配置：** 在配置面板中，填写以下关键信息并保存：
    * **助手名称**
    * **API Key**：您的外部 AI 服务的 Key。
    * **AI API 端点 (Endpoint URL)**：您的 AI 服务 API 地址 (例如：`https://api.openai.com/v1/chat/completions`)。
    * **模型选择**
    * **风格指令 (System Instruction)**

配置保存后，聊天功能即可正常使用。点击 **+ 新建对话** 按钮可随时重置上下文。# cloudflare-pages-grok
