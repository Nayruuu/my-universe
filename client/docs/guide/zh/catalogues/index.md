---
title: 星表与数据源
description: 查看Universe Map使用的主要天文目录、静态数据、来源和预处理流程。
---

# 星表与数据源

所有运行时数据都与应用一起托管。导入脚本会清理源快照、规范化标识符和单位、验证引用，
生成二进制目录或空间分块，并在部署前更新带版本的清单。

## 当前覆盖范围

| 图层           |                         覆盖范围 | 科学处理                                                             |
| -------------- | -------------------------------: | -------------------------------------------------------------------- |
| 太阳系         | 太阳、八大行星、部分卫星和小天体 | 本地星历和有文献依据的轨道提供器                                     |
| 已确认系外行星 |     4,747个宿主周围的6,333颗行星 | NASA综合目录；近距离系统为示意表达                                   |
| 恒星目录       |                  10,000颗HYG恒星 | 观测坐标并支持自行                                                   |
| 星座           |          88个现代图形、644条线段 | 与HYG标识符关联的文化约定                                            |
| 历史超新星     |                    6个事件和遗迹 | 有记录的位置与日期；视觉演化为示意                                   |
| 本星系群       |                         31个星系 | 目录位置与自适应形态                                                 |
| 附近宇宙       |                        720个星系 | 本地体积的静态八叉树                                                 |
| Cosmicflows-4  |                   37,730个星系群 | 根据公开字段计算的三维位置                                           |
| 大尺度结构     |               26,520个可定位探测 | 星系团、超星系团、墙、吸引盆地、吸引子、排斥子、空洞和纤维的独立产品 |
| Tempel纤维     |        15,421条脊线、275,599个点 | 以紧凑二进制层保留公开几何                                           |

Tempel二进制文件会在宇宙网尺度由专用Web Worker下载并验证。解码后的六个类型化数组缓冲区会以零复制
方式传回；不支持Worker的浏览器则在主线程使用同一个经过验证的加载器。

## 主要来源

- 行星与月球计算：[Astronomy Engine](https://github.com/cosinekitty/astronomy)；
- 系外行星：[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)；
- 恒星：[HYG Database v4.1](https://github.com/astronexus/HYG-Database)；
- 星座：[Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern)；
- 本星系群：[McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract)；
- 本地体积：[Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract)；
- 外层星系群：[Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94)；
- SDSS DR7、BOSS DR12、Planck PSZ2和[Tempel纤维](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465)；
- NASA Visible Earth及每项纹理注明的来源。

NASA/JPL与USGS的探测器拼接图为23个天体提供了基于观测的表面。补全区域、处理色彩和不完整覆盖
会在天体卡片中明确说明。Phobos和Deimos使用NASA/JPL-Caltech观测纹理模型，并仅在近距离LOD加载。
Ceres和Vesta使用基于Dawn成果的NASA VTAD观测纹理模型。Bennu使用NASA带纹理的3D模型；
67P使用ESA/OSIRIS观测形状，并配以明确标注为示意的中性表面。
来源：[JPL地图](https://space.jpl.nasa.gov/tmaps/)、
[USGS Astrogeology](https://astrogeology.usgs.gov/)、
[NASA Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/)、
[NASA Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/)、
[NASA Ceres](https://science.nasa.gov/resource/ceres-3d-model/)、
[NASA Vesta](https://science.nasa.gov/resource/vesta-3d-model/)、
[NASA Bennu](https://science.nasa.gov/resource/bennu-3d-model/)和
[ESA 67P](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289)。

许可证和转换过程会随数据一起记录。即使应用源代码采用MIT许可证，第三方材料仍遵循其
原始许可证。

`/data/manifest.json`是浏览器入口。每个数据集声明标识符、URL、类型和格式；加载器会在
交给引擎前验证JSON结构与二进制文件头。

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

准备好的产物会纳入版本控制并接受验证，仅在有意刷新数据源时重新导入。

下一页：[性能与限制](/zh/performance-and-limits/)。
