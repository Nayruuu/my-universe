---
title: 개발자 가이드
description: Universe Map 설치, Angular–Three.js 경계, 테스트, 데이터 준비와 공개 문서 빌드를 설명합니다.
---

# 개발자 가이드

Universe Map은 정적 Angular·Three.js 애플리케이션입니다. 렌더링 엔진은 프레임워크와
독립적이며 Angular는 타입이 지정된 파사드와 엔진 이벤트를 통해 인터페이스를 관리합니다.

## 설치와 실행

요구 사항은 Node.js 22와 npm입니다.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Angular 개발 서버는 기본적으로 `http://localhost:4200`에서 시작합니다.

## 구조

```text
client/src/
├── app/       Angular UI, 상태, 검색, 설정과 URL 동기화
├── engine/    Three.js 장면, 카메라, 렌더링, LOD, 타일과 시뮬레이션
└── data/      엄격한 모델과 런타임 검증

client/public/
├── data/      버전 관리되는 정적 천문 데이터
└── textures/  로컬 텍스처와 출처

docs/guide/    공개 가이드의 Markdown 원본
```

`client/src/engine`은 Angular를 가져오지 않아야 합니다. Three.js 리소스를 만드는 단위가
폐기도 담당하며 시간 계산은 렌더 루프와 분리합니다.

## 주요 명령

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

커버리지 게이트는 프로덕션 코드의 구문·분기·함수·줄 100%를 요구합니다. `verify:ci`는 빠른
배포 게이트이고 `verify`는 모든 데스크톱·모바일 Playwright 여정을 추가합니다.

애플리케이션과 가이드는 프랑스어, 영어, 스페인어, 독일어, 이탈리아어, 한국어, 일본어와
중국어 간체를 지원합니다. 앱은 `/fr/`부터 `/zh/`까지 사용하고 가이드 영어는 `/guide/`,
번역은 `/guide/ko/`, `/guide/fr/` 등에 있습니다. 중국어 표준 태그는 `zh-Hans`입니다.

`I18nService`는 엔진을 Angular에 결합하지 않고 텍스트, 숫자 형식과 번역 이름을 관리합니다.
`SeoService`는 메타데이터, canonical, `hreflang`, 매니페스트와 JSON-LD를 동기화하며 빌드는
검색 엔진이 바로 읽을 HTML을 생성합니다. 데이터 파이프라인은 브라우저 밖에서 카탈로그를
정규화하고 정적 이진 파일과 타일을 만듭니다. 런타임 애플리케이션 API를 추가하지 마세요.

풀 리퀘스트 전에는 UI–엔진 경계를 지키고 과학 계산에 독립 참조 테스트를 추가하며 사용자
변경은 `npm run verify`로 마무리합니다. 전체 구현 문서는 `docs/TECHNICAL_REFERENCE.md`입니다.

다음: [자주 묻는 질문](/ko/faq/).
