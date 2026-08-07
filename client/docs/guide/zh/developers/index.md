---
title: 开发者指南
description: 安装Universe Map，理解Angular–Three.js边界，运行测试，准备数据并构建公共文档。
---

# 开发者指南

Universe Map是静态Angular与Three.js应用。渲染引擎与框架无关；Angular负责界面，并通过
强类型外观服务和引擎事件通信。

## 安装与运行

要求：Node.js 22与npm。

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Angular开发服务器默认启动在`http://localhost:4200`。

## 架构

```text
client/src/
├── app/       Angular界面、状态、搜索、设置与URL同步
├── engine/    Three.js场景、相机、渲染、LOD、分块与模拟
└── data/      严格模型与运行时验证

client/public/
├── data/      带版本的静态天文数据
└── textures/  本地纹理与来源说明

docs/guide/    本公共指南的Markdown源文件
```

`client/src/engine`不得导入Angular。创建Three.js资源的模块也负责释放资源。时间计算必须与
渲染循环分离。

## 常用命令

```bash
cd client
npm run typecheck
npm run lint
npm run test:data
npm run test:coverage
npm run build
npm run test:e2e
npm run verify:ci
npm run verify
```

覆盖率门槛要求生产代码的语句、分支、函数和行均达到100%。`verify:ci`是快速部署门槛，
`verify`还会运行全部桌面与移动端Playwright流程。

应用和指南支持法语、英语、西班牙语、德语、意大利语、韩语、日语和简体中文。应用路由
使用`/fr/`至`/zh/`；指南英文保留在`/guide/`，译文位于`/guide/zh/`、`/guide/fr/`等路径。
中文标准标签使用`zh-Hans`。

`I18nService`管理文案、数字格式和翻译名称，而不让引擎依赖Angular。`SeoService`同步
元数据、canonical、`hreflang`、清单和JSON-LD；构建会生成搜索引擎可直接读取的HTML。
数据管线在浏览器外规范化目录并生成静态二进制文件或分块，运行时不得加入应用API。

提交Pull Request前，请保持UI–引擎边界，为科学计算添加独立参考测试，并对用户可见或
跨模块改动运行`npm run verify`。完整实现参考位于`docs/TECHNICAL_REFERENCE.md`。

下一页：[常见问题](/zh/faq/)。
