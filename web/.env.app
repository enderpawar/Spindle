# Capacitor 앱 빌드(`vite build --mode app`) 전용 환경변수.
#
# 앱은 웹 자산을 로컬 번들로 로드하므로 오리진이 https://localhost(Android) /
# capacitor://localhost(iOS)가 된다. 기본값인 상대경로 "/api"는 이 오리진으로 해석돼
# 존재하지 않는 주소를 때리므로, 프록시 Worker의 절대 URL을 반드시 지정해야 한다.
#
# 주의: Vite는 --mode app에서 .env.production을 읽지 않는다. 값이 같아도 여기 따로 둬야 한다.
# VITE_KAKAO_JS_KEY는 비밀이라 .env.local(gitignore)에 있으며, .env.local은 모든 모드에서 로드된다.
VITE_API_BASE=https://spindle-proxy.enderpawar.workers.dev/api
