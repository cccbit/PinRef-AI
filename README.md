# PinsRef AI - 视觉参考助手

这是一个专为设计师和艺术家打造的视觉参考分析工具。通过 Gemini AI 的深度分析，帮助您从参考图中提取精准的搜索关键词，并在 Pinterest 或 ArtStation 上快速找到相关的视觉灵感。

## 🚀 功能特点

- **AI 深度分析**：基于 Gemini 3.0 Flash 视觉模型，从构图、色彩、材质等多个维度分析图片。
- **精准关键词生成**：针对不同平台（Pinterest/ArtStation）生成最适合的专业搜索词。
- **一键搜索**：直接跳转到目标平台查看搜索结果。
- **隐私安全**：API Key 存储在浏览器本地，不经过任何第三方服务器。

## 🛠️ 部署到 GitHub Pages

本项目已配置好 GitHub Actions，可以实现自动部署：

1. **Fork 或上传代码**：将本项目代码上传到您的 GitHub 仓库。
2. **启用 GitHub Actions**：
   - 进入仓库的 **Settings > Pages**。
   - 在 **Build and deployment > Source** 下拉菜单中选择 **GitHub Actions**。
3. **自动部署**：每次您向 `main` 分支推送代码时，GitHub 会自动构建并发布您的网站。

## 🔑 如何使用

1. **获取 API Key**：前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取您的免费 Gemini API Key。
2. **配置应用**：
   - 打开部署好的网页。
   - 点击右上角的 **设置 (Settings)** 图标。
   - 粘贴您的 API Key 并保存。
3. **开始分析**：上传图片或输入描述，点击“开始深度分析”。

## 📦 技术栈

- **前端**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS 4.0
- **动画**：Motion (Framer Motion)
- **AI**：Google Gemini SDK (@google/genai)
- **图标**：Lucide React

## 📄 许可证

Apache-2.0
