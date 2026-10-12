# OCR結合テスト用の「印刷された算数問題」画像を作る (Pillow)。出力: tests/fixtures/worksheet.png
from PIL import Image, ImageDraw, ImageFont
W, H = 900, 700
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)
title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
body = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 64)
d.text((60, 40), 'Keisan', font=title, fill='black')
lines = ['(1)  12 + 8 =', '(2)  25 - 7 =', '(3)  6 × 7 =', '(4)  24 ÷ 4 =']
for i, t in enumerate(lines):
    d.text((80, 150 + i * 120), t, font=body, fill='black')
img.save('tests/fixtures/worksheet.png')
print('ok')
