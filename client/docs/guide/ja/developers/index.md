---
title: 開発者ガイド
description: Universe Mapのインストール、Angular–Three.js境界、テスト、データ準備、公開ドキュメントのビルドを説明します。
---

# 開発者ガイド

Universe Mapは静的なAngular・Three.jsアプリケーションです。レンダリングエンジンは
フレームワーク非依存で、Angularが型付きファサードとエンジンイベントを通じてUIを
管理します。

## インストールと実行

必要環境：Node.js 22とnpm。

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Angular開発サーバーは既定で`http://localhost:4200`に起動します。

## アーキテクチャ

```text
client/src/
├── app/       Angular UI、状態、検索、設定、URL同期
├── engine/    Three.jsシーン、カメラ、描画、LOD、タイル、シミュレーション
└── data/      厳密なモデルと実行時検証

client/public/
├── data/      バージョン管理された静的天文データ
└── textures/  ローカルテクスチャと出典

docs/guide/    公開ガイドのMarkdown原稿
```

`client/src/engine`はAngularをインポートしません。Three.jsリソースを作る単位が破棄も
担当し、時間計算はレンダーループから分離します。

## 主なコマンド

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

カバレッジゲートは本番コードの文・分岐・関数・行すべて100%を要求します。`verify:ci`
は高速なデプロイゲート、`verify`は全デスクトップ・モバイルPlaywrightテストを追加します。

アプリとガイドはフランス語、英語、スペイン語、ドイツ語、イタリア語、韓国語、日本語、
簡体字中国語に対応します。アプリは`/fr/`から`/zh/`を使用し、英語ガイドは`/guide/`、
翻訳は`/guide/ja/`や`/guide/fr/`以下にあります。中国語の標準タグは`zh-Hans`です。

`I18nService`はエンジンをAngularに結合せず文言、数値形式、翻訳名を管理します。
`SeoService`はメタデータ、canonical、`hreflang`、マニフェスト、JSON-LDを同期し、ビルドは
検索エンジンが直接読めるHTMLを生成します。データパイプラインはブラウザ外でカタログを
正規化して静的バイナリやタイルを作ります。実行時APIを追加しないでください。

プルリクエストではUI–エンジン境界を守り、科学計算に独立参照テストを加え、表示に関わる
変更は`npm run verify`で完了させます。完全な資料は`docs/TECHNICAL_REFERENCE.md`です。

次へ：[よくある質問](/ja/faq/)。
