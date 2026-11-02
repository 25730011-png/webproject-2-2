# 냉장고 털이

집에 있는 재료로 지금 만들 수 있는 요리를 찾아 주는 모바일 웹 (수업 팀 프로젝트). 7주차: `data/recipes.json`을 fetch로 연결하고, 데이터 점검(`checkData`)과 출처 표시(실제·더미·API 태그)를 적용했습니다. 심화 트랙: 팀 작성 레시피 24건의 영양정보·사진·팁을 식약처 Open API로 채웁니다.

## 실행

GitHub Pages 배포 주소에서 확인합니다. HTML을 더블클릭해 열면(file://) 브라우저가 fetch로 JSON 읽기를 막아 목록이 "불러오기 실패"로 표시됩니다. JSON을 고친 뒤에는 커밋·푸시 → Actions 탭에서 배포 완료 확인 → 강력 새로고침(Ctrl+Shift+R).

```
index.html
css/style.css
js/app.js            # 화면 전환 + 7주차 loadData() · checkData() · renderList() · openDetail() + fetchApi()
js/config.js         # 식약처 Open API 인증키 (API_KEY) — 공개 배포되므로 유출 시 재발급
js/config.example.js # config.js 양식
data/COOKRCP01_100.csv   # 원본 데이터셋 (식약처 55열 + 플래그 열 8개) — 수정은 여기서
data/COOKRCP01_100.xlsx  # 같은 데이터의 엑셀 + 범례 + 출처·구분표 시트(강의 1.4.2)
data/recipes.json        # CSV에서 변환한 화면용 JSON (각 항목에 meta 출처 플래그)
data/ingredients.json · recipe_ingredients.json · substitutes.json
tools/csv_to_json.py     # CSV → recipes.json 변환 스크립트
```

## 데이터 출처

| 데이터 | 출처 | 건수 | 비고 |
|---|---|---|---|
| 레시피 (이름·조리방법·분류·재료·조리순서·영양정보·사진·팁) | **식품의약품안전처 식품안전나라 「조리식품의 레시피 DB」(COOKRCP01)** — https://www.foodsafetykorea.go.kr/api/openApiInfo.do · 공공데이터포털 https://www.data.go.kr (공공누리, 원본 페이지의 이용 조건 확인) | 76건 | 저장 JSON 사용 (API 미연동). 사진은 식약처 서버 링크 |
| 레시피 (이름·조리방법·분류·재료·조리순서) | **팀 직접 작성** (시연용, 검증 없음) | 24건 | id 90001~90024, `hashtag: "팀작성"`. 저장 JSON에는 영양정보·사진·팁 없음 |
| 팀 작성 24건의 영양정보(열량·탄수화물·단백질·지방·나트륨)·사진·팁 | **식약처 Open API** 조리식품의 레시피 DB(COOKRCP01) — 상세 화면을 열 때 요리명으로 검색, `meta.source: "api"`·`meta.api` 7개 필드 | 24건 | 실행 중에만 표시, JSON·CSV에 저장 안 함. 같은 이름의 레시피가 없거나 요청 실패면 '정보 없음 [대체]'. 요청 시각을 화면에 표시 |
| 조리시간 `time` · 난이도 `level` | 팀이 규칙으로 임의 배정한 **더미** | 100건 | 조리방법 → 시간, 재료 수 → 난이도. 실제 값 아님 |
| 재료 사전 · 레시피-재료 · 대체 재료 | 팀 직접 입력 (와이어프레임용 더미) | 5·3·1건 | |
| 게시물 · 좋아요 · 별점 · 사용자 닉네임 · 내 냉장고 | HTML에 직접 적은 예시 | – | JSON 데이터 아님. 게시물·사용자 데이터는 '개인 상태 저장' 범위라 이후 주차에 posts.json 등으로 분리 예정 |

- **API 연동 범위**: `meta.source: "api"`인 팀 작성 24건만 상세 화면에서 호출합니다. 식약처 76건은 저장 JSON과 같은 데이터셋이라 호출하지 않습니다(`meta.source: "json"`). API 연동이 곧 실시간·검증 데이터를 뜻하지는 않습니다(강의 1.4.1) — 응답값은 식약처 레시피 DB의 저장값이며 요리명이 같다고 같은 레시피라는 보장은 없습니다.
- **인증키 노출**: GitHub Pages는 정적 사이트라 `js/config.js`의 키가 그대로 공개됩니다. 공공데이터 키(일일 호출 한도만 있음)라 감수하는 한계이며, 한도 초과·유출 시 식품안전나라에서 재발급합니다. 유료·개인정보 API에는 이 구조를 쓰지 않습니다.
- **CORS**: 브라우저에서 직접 호출하므로 식약처 서버가 CORS를 막으면 요청이 실패하고 '대체'로 표시됩니다. 배포 후 F12 Console의 `[API 대체]` 경고 사유로 확인합니다.
- 식약처 76건과 팀 작성 24건이 한 파일에 섞여 있으므로 "식약처 데이터 100건"으로 설명하지 않습니다. 화면에서는 카드마다 `식약처` / `팀 작성` 출처 칩, 값마다 `실제` / `더미` 태그로 구분합니다.
- 영양정보는 식약처 자료의 1인분 기준 참고값이며, 식약처 자료에 값이 없는 항목(중량 등)은 추정하지 않고 '정보 없음'으로 둡니다.
- 필드별 상세 구분·변환 규칙·한계는 `data/COOKRCP01_100.xlsx`의 출처·구분표 시트(1~6번) 참고.

## 데이터 수정 흐름

1. `data/COOKRCP01_100.csv`에서 레시피 값이나 플래그 열(`meta_source`·`meta_real`·`meta_dummy`·`meta_api`)을 고침 (엑셀로 열었다면 CSV UTF-8로 저장)
2. `python tools/csv_to_json.py` 실행 → `data/recipes.json` 재생성
3. 커밋·푸시 → 배포 주소에서 강력 새로고침 → F12 Console의 `[데이터 점검]` 확인
4. `COOKRCP01_100.xlsx`의 출처·구분표 시트도 같이 갱신

## 출처 플래그 (meta)

```json
// 식약처 원본 76건
"meta": { "source": "json",
  "real":  ["name","method","category","weight","calories","carb","protein","fat","sodium",
            "hashtag","image","imageStep","ingredientsText","steps","tip"],
  "dummy": ["time","level"], "api": [] }

// 팀 작성 24건 — 저장 JSON + API (강의 1.4.4 B카페와 같은 구조)
"meta": { "source": "api", "real": [],
  "dummy": ["name","method","category","ingredientsText","steps","time","level"],
  "api":   ["calories","carb","protein","fat","sodium","image","tip"],
  "note":  "팀 작성 레시피 — 영양정보·사진·팁은 식약처 API(COOKRCP01)를 요리명으로 검색해 실행 중 표시" }
```

## 7주차 범위

- 한 것: JSON 연결(fetch), `checkData()` 점검(배열·건수·id 중복·자료형·허용값·필수 필드·출처 플래그), 목록·상세·홈 추천을 JSON으로 렌더링, 출처 칩·필드 태그, 이미지·영양정보·팁 등 추가 필드 표시
- 결과 없음 / 불러오기 실패 화면 구분(강의 1.2): 목록은 보유 재료가 들어간 레시피만 보여주고 0건이면 '결과 없음'(점선 상자, 조건 넓히기 안내·전체 보기 버튼), 검색 화면(레시피 탭)은 이름·재료 텍스트로 검색해 0건이면 '결과 없음', JSON을 못 읽으면 두 화면 모두 빨간 '불러오기 실패'
- 홈 재료 입력창에 재료를 치고 Enter로 칩 추가 (달걀=계란, 참치캔=참치, 묵은지=김치 표기 통일)
- 심화 트랙: 식약처 Open API 연동(`fetchApi()`, 5초 타임아웃, 메모리 캐시, 실패 시 '대체' 태그), `checkData()`에 API 플래그 점검 추가
- 안 한 것(이후 주차): 난이도·조리시간 필터와 정렬, 재료 매칭 로직 고도화(현재는 재료 텍스트에 보유 재료 이름이 포함된 수만 셈), 즐겨찾기 저장

## 데이터 점검 결과 확인

배포 주소에서 F12 → Console의 `[데이터 점검] ./data/recipes.json` 그룹을 펼치면 건수 100, `항목 출처: {json: 76, api: 24}`, `작성 주체: {식약처: 76, 팀작성: 24}`, 경고 없음이 표시됩니다.

## API 연동 확인 순서

1. F12 Console에서 `fetch('https://openapi.foodsafetykorea.go.kr/api/' + API_KEY + '/COOKRCP01/json/1/1/RCP_NM=김치찌개').then(r => r.json()).then(console.log)` 한 줄로 키·CORS 동작 확인
2. 팀 작성 레시피(예: 김치찌개 id 90023) 상세를 열면 Network 탭에 `openapi.foodsafetykorea.go.kr` 요청 1건, 영양정보 옆에 검정 `API` 태그, "API 정보" 박스에 요청 시각
3. 같은 항목을 다시 열면 요청이 추가되지 않음(캐시)
4. 식약처 레시피(예: id 38) 상세는 요청 없음, "API 미연동 (저장 JSON 항목)"
5. `js/config.js`의 키를 일부러 틀리게 한 뒤 다른 팀 작성 레시피를 열면 `정보 없음 [대체]` + Console `[API 대체]` 경고, 화면은 깨지지 않음
