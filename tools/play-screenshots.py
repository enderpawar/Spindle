# -*- coding: utf-8 -*-
"""Google Play 스토어 등록용 휴대전화 스크린샷 생성.

실기기 캡처는 1080x2400(20:9)이라 Play 규격을 위반한다.
  - Play 규정: "최대 변은 최소 변의 2배를 넘을 수 없다" → 2400 > 1080*2 = 2160 이므로 거부 대상
  - 권장 규격: 9:16 세로, 최소 1080x1920 (스크린샷 4장 이상이면 추천 게재 자격도 충족)

원본을 자르지 않고 1080x1920 캔버스 안에 높이 기준으로 축소해 넣고,
남는 좌우 여백은 캡처 상단 색으로 채워 자연스럽게 잇는다.
알파 채널 없는 24bit PNG로 저장한다(Play 요구사항).
"""
import os
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'tools', 'store-screenshots', 'public', 'screenshots', 'android', 'phone')
OUT = os.path.join(REPO, 'fastlane', 'metadata', 'android', 'ko-KR', 'images', 'phoneScreenshots')

W, H = 1080, 1920

# Play 스토어에 노출할 순서 — 첫 두 장이 목록에서 가장 많이 보인다
ORDER = ['1_spin', '2_map', '3_home', '4_stamp', '5_settings']


def build(name):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGB')
    scale = H / im.height
    nw, nh = int(round(im.width * scale)), H
    im = im.resize((nw, nh), Image.LANCZOS)
    if nw >= W:                       # 이미 충분히 넓으면 가운데를 잘라 맞춘다
        left = (nw - W) // 2
        return im.crop((left, 0, left + W, H))
    bg = im.getpixel((im.width // 2, 2))   # 상단 배경색을 여백 색으로
    canvas = Image.new('RGB', (W, H), bg)
    canvas.paste(im, ((W - nw) // 2, 0))
    return canvas


os.makedirs(OUT, exist_ok=True)
for name in ORDER:
    out = os.path.join(OUT, name + '.png')
    img = build(name)
    img.save(out, 'PNG')
    w, h = img.size
    ok = 320 <= w and 320 <= h and max(w, h) <= 3840 and max(w, h) <= 2 * min(w, h)
    print('%-12s %dx%d  ratio %.3f  %s  %.1fKB' % (
        name, w, h, h / w, 'OK' if ok else 'VIOLATION', os.path.getsize(out) / 1024))
