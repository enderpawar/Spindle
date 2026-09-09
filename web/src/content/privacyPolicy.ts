/**
 * 개인정보처리방침 본문의 **단일 원본**.
 *
 * 같은 내용이 스토어 등록용 공개 URL(`web/public/privacy.html` → `/privacy`)에도 있어야 하므로,
 * 두 본문이 갈라지면 `privacyPolicy.test.ts`가 `npm run check`에서 실패시킨다.
 * 방침을 고칠 때는 **이 파일과 `public/privacy.html`을 함께** 고친다.
 *
 * 단, `출처: ⓒ한국관광공사`는 여기 담지 않는다 — 이 시트는 공공데이터를 보여주는 화면이 아니라
 * 방침 문서이고, 출처 표기는 실제로 TourAPI 데이터를 그리는 화면(`SourceLine`)과 스토어 제출용
 * `public/privacy.html`이 이미 지고 있다 (AGENTS.md 절대 원칙 6).
 */

export const PRIVACY_TITLE = 'Spindle 개인정보처리방침'
export const PRIVACY_EFFECTIVE_DATE = '2026-08-14'
export const PRIVACY_CONTACT_EMAIL = 'enderpawar@gmail.com'

export type PrivacyBlock =
  /** 일반 문단 */
  | { kind: 'p'; text: string }
  /** 굵은 머리말(`lead`)이 붙을 수 있는 목록 */
  | { kind: 'list'; items: readonly { lead?: string; text: string }[] }
  /** 문의처 — 이메일은 상수에서 가져와 mailto 링크로 렌더한다 */
  | { kind: 'contact'; label: string }

export interface PrivacySection {
  id: string
  heading: string
  blocks: readonly PrivacyBlock[]
}

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: 'overview',
    heading: '1. 개요',
    blocks: [
      {
        kind: 'p',
        text: 'Spindle은 휴대폰을 돌리거나 흔들어 나침반이 가리키는 방향의 부산 원도심·영도 관광지를 추천하는 관광 탐색 웹앱 및 Android/iOS 앱입니다. Spindle은 회원가입이나 로그인을 제공하지 않으며, 이름, 이메일, 전화번호 등 개인을 식별할 수 있는 정보를 수집하지 않습니다.',
      },
    ],
  },
  {
    id: 'not-collected',
    heading: '2. 수집하지 않는 정보',
    blocks: [
      {
        kind: 'p',
        text: 'Spindle에는 계정이 없으며 이름, 이메일 주소, 전화번호를 비롯한 개인식별정보를 수집하지 않습니다. 광고, 인앱결제, 사용자 생성 콘텐츠 및 분석·추적 SDK도 사용하지 않습니다.',
      },
    ],
  },
  {
    id: 'location-and-sensors',
    heading: '3. 위치정보 및 센서 정보의 처리',
    blocks: [
      {
        kind: 'p',
        text: '위치정보(GPS)와 방위 정보(나침반)는 관광지 방향 추천을 위해 단말 내에서만 사용됩니다. 방향 계산, 거리 계산 및 권역 판정은 모두 기기 안에서 이루어지며, 위치정보와 방위 정보는 어떤 서버로도 전송되지 않습니다.',
      },
      {
        kind: 'p',
        text: '앱은 위치 권한을 앱 사용 중에만 요청하며 백그라운드 위치를 사용하지 않습니다. 위치 또는 모션·방위 센서 권한을 거부해도 지도에서 출발점을 직접 선택해 서비스를 이용할 수 있습니다.',
      },
    ],
  },
  {
    id: 'device-storage',
    heading: '4. 기기에 저장되는 정보',
    blocks: [
      {
        kind: 'p',
        text: '방문한 관광지의 식별자(도장깨기 기록)와 앱 설정이 기기 내부에만 저장됩니다. 이 정보는 서버로 전송되지 않으며 앱을 삭제하면 함께 삭제됩니다. Spindle은 서버에 사용자 정보를 저장하는 저장소를 두고 있지 않습니다.',
      },
    ],
  },
  {
    id: 'external-services',
    heading: '5. 제3자 제공 및 외부 서비스',
    blocks: [
      {
        kind: 'list',
        items: [
          {
            lead: '한국관광공사 TourAPI:',
            text: '관광지 정보를 실시간으로 받아오는 데 사용합니다. 자체 프록시 서버(Cloudflare Workers)는 API 키를 주입하고 요청을 중계할 뿐이며 사용자 좌표를 받지 않습니다.',
          },
          {
            lead: '카카오맵:',
            text: '지도를 표시하고 길찾기로 연결하는 데 사용합니다. 길찾기 링크에는 목적지 관광지의 좌표만 담기며 사용자의 현재 위치는 넣지 않습니다. 다만 지도를 화면에 그릴 때 지도 데이터가 카카오 서버에서 전달되므로, 현재 위치를 기준으로 지도를 보는 경우 해당 지역을 조회한다는 사실이 카카오맵에 전달될 수 있습니다. 이때 적용되는 처리 기준은 카카오의 개인정보처리방침을 따릅니다.',
          },
        ],
      },
      {
        kind: 'p',
        text: 'Spindle은 사용자의 위치정보와 방위 정보를 자체 프록시 서버나 한국관광공사 TourAPI로 전송하지 않습니다. 관광지 조회 요청에는 좌표가 포함되지 않으며, 지역 코드만 사용합니다.',
      },
    ],
  },
  {
    id: 'children',
    heading: '6. 아동의 개인정보',
    blocks: [
      {
        kind: 'p',
        text: 'Spindle은 만 14세 미만 아동을 특정해 겨냥한 서비스가 아니며, 이용자의 나이를 포함한 개인식별정보를 수집하지 않습니다.',
      },
    ],
  },
  {
    id: 'changes',
    heading: '7. 방침 변경 고지',
    blocks: [
      {
        kind: 'p',
        text: '이 개인정보처리방침의 내용이 변경되는 경우 이 페이지를 통해 변경 내용과 시행일자를 알립니다.',
      },
    ],
  },
  {
    id: 'contact',
    heading: '8. 문의처',
    blocks: [{ kind: 'contact', label: '문의' }],
  },
]
