/** 냉장고 털이 — Google Sheets를 간단한 DB로 쓰기 (선택)
 * 1) 구글 시트 새로 만들기 → 확장 프로그램 › Apps Script → 이 코드 붙여넣기
 * 2) 배포 › 새 배포 › 유형 "웹 앱", 실행 주체 "나", 액세스 "모든 사용자" → 배포 → URL 복사
 * 3) js/config.js 의 SHEET_WEBAPP_URL 에 붙여넣기
 * 화면에서 로그인·레시피 등록·게시물 작성 때 한 줄씩 기록됨 (kind 별 시트: login / recipe / post)
 * 브라우저는 no-cors 로 보내므로 응답을 읽지 않음 — 기록 여부는 시트에서 확인 */
function doPost(e) {
  var data = JSON.parse(e.postData.contents || '{}');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = ['login', 'recipe', 'post'].indexOf(data.kind) >= 0 ? data.kind : 'etc';
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(['at', 'kind', 'payload(JSON)']);
  sh.appendRow([data.at || new Date().toISOString(), data.kind || '', JSON.stringify(data)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput('냉장고 털이 sheets webapp OK'); }
