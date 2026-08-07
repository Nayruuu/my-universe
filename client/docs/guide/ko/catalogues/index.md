---
title: 카탈로그와 출처
description: Universe Map이 사용하는 주요 천문 카탈로그, 정적 데이터, 출처와 전처리 과정을 확인합니다.
---

# 카탈로그와 출처

실행에 필요한 모든 데이터는 애플리케이션과 함께 호스팅됩니다. 가져오기 스크립트는 원본
스냅샷을 정리하고 식별자와 단위를 정규화하며 참조를 검증한 뒤 이진 카탈로그나 공간
타일을 만들고 배포 전에 버전 매니페스트를 갱신합니다.

## 현재 범위

| 레이어          |                              범위 | 과학적 처리                             |
| --------------- | --------------------------------: | --------------------------------------- |
| 태양계          | 태양, 여덟 행성, 선별 위성·소천체 | 국부 행성력과 문서화된 궤도 공급자      |
| 확인 외계행성   |  호스트 4,747개 주위 행성 6,333개 | NASA 종합 카탈로그, 근접 보기는 설명용  |
| 항성 카탈로그   |                   HYG 별 10,000개 | 관측 좌표와 고유운동                    |
| 별자리          |             현대 88개, 선분 644개 | HYG 식별자에 연결된 문화적 관습         |
| 역사적 초신성   |                   사건과 잔해 6개 | 문서화된 위치·날짜, 설명용 시각 진화    |
| 국부은하군      |                         은하 31개 | 카탈로그 위치와 적응형 형태             |
| 가까운 우주     |                        은하 720개 | 국부 부피 정적 옥트리                   |
| Cosmicflows-4   |                   은하군 37,730개 | 공개 필드에서 계산한 3차원 위치         |
| 거대 구조       |    위치 지정 가능한 검출 26,500개 | 은하단·초은하단·공동·필라멘트 개별 자료 |
| Tempel 필라멘트 |         축 15,421개, 점 275,599개 | 공개 기하를 보존한 압축 이진 레이어     |

## 주요 출처

- 행성과 달 계산의 [Astronomy Engine](https://github.com/cosinekitty/astronomy);
- 외계행성의 [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/);
- 항성의 [HYG Database v4.1](https://github.com/astronexus/HYG-Database);
- 별자리의 [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern);
- 국부은하군의 [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract);
- 국부 부피의 [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract);
- 외곽 은하군의 [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94);
- SDSS DR7, BOSS DR12, Planck PSZ2와 [Tempel 필라멘트](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth와 각 텍스처에 기록된 출처.

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
