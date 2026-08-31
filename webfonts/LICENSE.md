# 웹폰트 라이선스

이 폴더의 woff2 파일은 아래 폰트를 **웹 사용에 필요한 글리프만 서브셋**한 것입니다.

## 온글잎 박다현체 (OnglipParkDahyun.woff2)
- 원본: 온글잎(Onglyph) 박다현체 — 개인/상업용 무료, 임베딩 허용
- 서브셋 범위: 사용된 한글 음절 + 기본 라틴/기호
- 재배포·2차 활용 시 원 배포처(온글잎) 라이선스를 확인하세요.

## Cafe24 Ssurround v2.0 (Cafe24Ssurround.woff2)
- 원본: Cafe24 Ssurround — 개인/기업 상업용 무료, 재배포 허용(라이선스 동봉 조건)
- 전체 라이선스 원문: `../fonts/Cafe24Ssurround-v2.0/License-Ssurround.pdf`
- 서브셋 범위: 라틴/숫자/문장부호/기호 (한글 글리프 제외 — 숫자·영문 포인트 용도)

## 재생성 방법
```sh
pip3 install --user fonttools brotli
pyftsubset "fonts/온글잎 박다현체.ttf" \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+2018-201F,U+2026,U+3000-303F,U+3130-318F,U+1100-11FF,U+AC00-D7A3" \
  --flavor=woff2 --output-file=webfonts/OnglipParkDahyun.woff2
# (한글 전체 포함 시 ~965KB. 현재는 data.js에 실제 쓰인 글자만 --text-file 로 서브셋해 ~132KB)

pyftsubset "fonts/Cafe24Ssurround-v2.0/Cafe24Ssurround-v2.0.otf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2000-206F,U+2190-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+20A0-20BF" \
  --flavor=woff2 --output-file=webfonts/Cafe24Ssurround.woff2
```
