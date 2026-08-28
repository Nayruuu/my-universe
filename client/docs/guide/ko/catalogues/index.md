---
title: 카탈로그와 출처
description: Universe Map이 사용하는 주요 천문 카탈로그, 정적 데이터, 출처와 전처리 과정을 확인합니다.
---

# 카탈로그와 출처

실행에 필요한 모든 데이터는 애플리케이션과 함께 호스팅됩니다. 가져오기 스크립트는 원본
스냅샷을 정리하고 식별자와 단위를 정규화하며 참조를 검증한 뒤 이진 카탈로그나 공간
타일을 만들고 배포 전에 버전 매니페스트를 갱신합니다.

## 현재 범위

| 레이어          |                                  범위 | 과학적 처리                                                     |
| --------------- | ------------------------------------: | --------------------------------------------------------------- |
| 태양계          |     태양, 여덟 행성, 선별 위성·소천체 | 국부 행성력과 문서화된 궤도 공급자                              |
| 확인 외계행성   |      호스트 4,747개 주위 행성 6,333개 | NASA 종합 카탈로그, 근접 보기는 설명용                          |
| 항성 카탈로그   |                       HYG 별 10,000개 | 관측 J2000 위치·속도, ±10,000 율리우스년 범위의 제한 선형 전파  |
| Gaia 항성 계층  | 입력 2,923,790개, 측정 표본 133,526개 | 계산된 512 pc 집계, 측정 J2016.0 표본, 불완전한 배경            |
| 별자리          |                 현대 88개, 선분 644개 | HYG 식별자에 연결된 문화적 관습                                 |
| 역사적 초신성   |                       사건과 잔해 6개 | 문서화된 위치·날짜, 설명용 시각 진화                            |
| 국부은하군      |                             은하 31개 | 카탈로그 위치와 적응형 형태                                     |
| 가까운 우주     |                            은하 720개 | 국부 부피 정적 옥트리                                           |
| Cosmicflows-4   |                       은하군 37,730개 | 공개 필드에서 계산한 3차원 위치                                 |
| 거대 구조       |        위치 지정 가능한 검출 26,520개 | 은하단·초은하단·벽·인력권·인력원·반발원·공동·필라멘트 개별 자료 |
| Tempel 필라멘트 |             축 15,421개, 점 275,599개 | 공개 기하를 보존한 압축 이진 레이어                             |

Tempel 바이너리는 우주 거대구조 스케일에서 전용 Web Worker가 다운로드하고 검증합니다. 디코딩된
6개의 형식화 배열 버퍼는 복사 없이 전송되며, Worker를 지원하지 않는 브라우저는 메인 스레드에서
동일한 검증 로더를 사용합니다.

## 주요 출처

- 행성과 달 계산의 [Astronomy Engine](https://github.com/cosinekitty/astronomy);
- 외계행성의 [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/);
- 항성의 [HYG Database v4.1](https://github.com/astronexus/HYG-Database);
- 품질 필터 하이브리드 항성 배경의
  [Gaia Data Release 3](https://www.cosmos.esa.int/web/gaia/data-release-3) `gaia_source_lite`;
- 별자리의 [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern);
- 국부은하군의 [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract);
- 국부 부피의 [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract);
- 외곽 은하군의 [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94);
- SDSS DR7, BOSS DR12, Planck PSZ2와 [Tempel 필라멘트](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth와 각 텍스처에 기록된 출처.

NASA/JPL과 USGS 탐사선 모자이크로 23개 천체의 관측 기반 표면을 추가합니다. 채워진 공백,
처리된 색상, 불완전한 관측 범위는 천체 카드에 표시됩니다. Phobos와 Deimos는 근접 LOD에서만
불러오는 NASA/JPL-Caltech의 관측 텍스처 모델을 사용합니다. Ceres와 Vesta는 Dawn 자료를 기반으로
한 NASA VTAD의 관측 텍스처 모델을 사용합니다. Bennu는 NASA의 텍스처 3D 모델을,
67P는 ESA/OSIRIS의 관측 형상과 명시적으로 예시용인 중성 표면을 사용합니다. 출처:
[JPL 지도](https://space.jpl.nasa.gov/tmaps/), [USGS Astrogeology](https://astrogeology.usgs.gov/),
[NASA Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/),
[NASA Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/),
[NASA Ceres](https://science.nasa.gov/resource/ceres-3d-model/),
[NASA Vesta](https://science.nasa.gov/resource/vesta-3d-model/),
[NASA Bennu](https://science.nasa.gov/resource/bennu-3d-model/),
[ESA 67P](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289).

라이선스와 변환 내역은 데이터 옆에 기록됩니다. 애플리케이션 코드가 MIT여도 제3자
자료는 원래 라이선스를 유지합니다.

`/data/manifest.json`이 브라우저 진입점입니다. 각 데이터셋은 ID, URL, 유형과 형식을
선언하고 로더는 엔진에 전달하기 전에 JSON 구조와 이진 헤더를 검증합니다.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

준비된 아티팩트는 버전 관리와 검증을 거치며 원본을 의도적으로 갱신할 때만 다시
가져옵니다.

다음: [성능과 한계](/ko/performance-and-limits/).
