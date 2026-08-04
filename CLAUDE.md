# Spindle — Claude Code 안내

@AGENTS.md

## Claude 전용 참고

- 공통 규칙·문서 맵의 단일 소스는 `AGENTS.md`다. 규칙을 추가·변경할 때는 이 파일이 아니라 **AGENTS.md를 수정**한다 (Codex 등 다른 에이전트도 함께 봐야 하므로).
- AGENTS.md의 "구현 규약 문서" 표에 있는 `.claude/skills/` 문서들은 Claude Code에서는 스킬로 자동 발동된다 (`tourapi`, `algorithm`, `sensors`, `pwa`, `submission-check`).
- 구현은 `/phase N`으로 실행한다 (PLAN.md 기준). `/phase status`로 진행 상태 확인, 제출 전 점검은 `/submission-check`.
- **claude-in-chrome(브라우저 자동화)은 사용자가 명시적으로 요청할 때만 사용한다.** 화면 확인이 필요하면 스스로 브라우저를 열지 말고, dev 서버·프리뷰 URL을 알려주고 사용자가 직접 보게 한다. 탭 생성·네비게이션·스크린샷 모두 해당된다.
