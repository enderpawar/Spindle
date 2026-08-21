/**
 * 홈에서 뒤로가기를 한 번 눌렀을 때의 종료 안내.
 *
 * 알약·색 배경·아이콘 없이 조용한 한 줄로만 알린다 (docs/ui.md 디자인 톤).
 * 어느 화면 위에도 떠야 해서 `position: fixed`를 쓰지만, 흰 글로우로 가독성만
 * 확보하고 배경 판을 만들지 않는다 — 명소 지도 오버레이 텍스트와 같은 처리다.
 */
export function ExitNotice() {
  return (
    <p className="exit-notice motion-status" role="status">
      뒤로 한 번 더 누르면 앱을 닫아요
    </p>
  )
}
