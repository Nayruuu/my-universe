---
title: カタログと出典
description: Universe Mapが使用する主要な天文カタログ、静的データ、来歴、前処理を確認します。
---

# カタログと出典

実行時データはすべてアプリケーションと同じ場所で配信されます。インポートスクリプトが
原典を整理し、識別子と単位を正規化し、参照を検証して、バイナリカタログまたは空間
タイルを生成し、公開前にバージョン付きマニフェストを更新します。

## 現在の収録範囲

| レイヤー           |                            収録範囲 | 科学的な扱い                                                                         |
| ------------------ | ----------------------------------: | ------------------------------------------------------------------------------------ |
| 太陽系             | 太陽、8惑星、選択された衛星と小天体 | ローカル天体暦と文書化された軌道プロバイダー                                         |
| 確認済み系外惑星   |          4,747恒星の周囲に6,333惑星 | NASA複合カタログ、近接ビューは説明用                                                 |
| 恒星カタログ       |                     HYG恒星10,000個 | 観測J2000位置・速度。±10,000ユリウス年で線形伝播を制限                               |
| 星座               |                 現代88図形、644線分 | HYG識別子に対応した文化的慣習                                                        |
| 歴史的超新星       |                     6イベントと残骸 | 公開位置・日時、視覚的進化は説明用                                                   |
| 局所銀河群         |                              31銀河 | カタログ位置と適応形態                                                               |
| 近傍宇宙           |                             720銀河 | 局所体積の静的オクツリー                                                             |
| Cosmicflows-4      |                        37,730銀河群 | 公開フィールドから計算した3次元位置                                                  |
| 大規模構造         |              位置を持つ検出26,520件 | 銀河団・超銀河団・壁・引力圏・アトラクター・リペラー・ボイド・フィラメントの個別製品 |
| Tempelフィラメント |                 15,421軸、275,599点 | 公開形状を保持した小型バイナリレイヤー                                               |

Tempelバイナリは宇宙網スケールで専用Web Workerにより取得・検証されます。デコードされた6個の型付き
配列バッファーはコピーせずに転送され、Worker非対応ブラウザーでは同じ検証済みローダーをメイン
スレッドで使用します。

## 主な出典

- 惑星・月計算の[Astronomy Engine](https://github.com/cosinekitty/astronomy)；
- 系外惑星の[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)；
- 恒星の[HYG Database v4.1](https://github.com/astronexus/HYG-Database)；
- 星座の[Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern)；
- 局所銀河群の[McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract)；
- 近傍体積の[Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract)；
- 外側銀河群の[Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94)；
- SDSS DR7、BOSS DR12、Planck PSZ2、[Tempelフィラメント](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465)；
- NASA Visible Earthと各テクスチャに記録された出典。

NASA/JPLとUSGSの探査機モザイクにより、23天体の観測ベース表面を追加しています。補完された
欠損、処理色、不完全な観測範囲は天体カードで明示します。PhobosとDeimosはNASA/JPL-Caltechの
観測テクスチャ付きモデルを使用し、近接LODでのみ読み込みます。CeresとVestaはDawn成果に基づく
NASA VTADの観測テクスチャ付きモデルを使用します。BennuはNASAのテクスチャ付き3Dモデル、
67PはESA/OSIRISの観測形状に明示的な説明用中性色を使用します。出典：
[JPLマップ](https://space.jpl.nasa.gov/tmaps/)、[USGS Astrogeology](https://astrogeology.usgs.gov/)、
[NASA Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/)、
[NASA Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/)、
[NASA Ceres](https://science.nasa.gov/resource/ceres-3d-model/)、
[NASA Vesta](https://science.nasa.gov/resource/vesta-3d-model/)、
[NASA Bennu](https://science.nasa.gov/resource/bennu-3d-model/)、
[ESA 67P](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289)。

ライセンスと変換内容はデータとともに記録されます。アプリコードがMITでも、第三者
資料は元のライセンスに従います。

`/data/manifest.json`がブラウザの入口です。各データセットはID、URL、種類、形式を宣言し、
ローダーはエンジンへ渡す前にJSON構造とバイナリヘッダーを検証します。

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

準備済み成果物はバージョン管理と検証を行い、原典を意図的に更新するときだけ再生成
します。

次へ：[性能と制限](/ja/performance-and-limits/)。
