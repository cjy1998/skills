#!/usr/bin/env python3
"""校验小红书信息图 PNG 并打包发布素材。
用法: python3 verify_and_pack.py --dir <工作目录> --zip <输出zip路径> [--count 5] [--width 1080] [--height 1440]
目录内应有 images/NN-slug.png、images/contact-sheet.png、小红书笔记文案.txt（可选）。
"""
import argparse
import struct
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--dir', required=True)
parser.add_argument('--zip', required=True)
parser.add_argument('--count', type=int, default=5)
parser.add_argument('--width', type=int, default=1080)
parser.add_argument('--height', type=int, default=1440)
args = parser.parse_args()
root = Path(args.dir).resolve()
images = sorted(p for p in (root / 'images').glob('*.png') if p.name != 'contact-sheet.png')
failures = []
if len(images) != args.count:
    failures.append(f'期望 {args.count} 张页面图，实际 {len(images)} 张: {[p.name for p in images]}')
for image in images:
    data = image.read_bytes()
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        failures.append(f'{image.name}: 不是 PNG')
        continue
    width, height = struct.unpack('>II', data[16:24])
    if (width, height) != (args.width, args.height):
        failures.append(f'{image.name}: 尺寸 {width}x{height}，期望 {args.width}x{args.height}')
if not (root / 'images' / 'contact-sheet.png').exists():
    failures.append('缺少 images/contact-sheet.png')
if failures:
    print('FAIL')
    for f in failures:
        print(' -', f)
    raise SystemExit(1)
zip_path = Path(args.zip).resolve()
zip_path.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for image in images:
        z.write(image, '发布图片/' + image.name)
    z.write(root / 'images' / 'contact-sheet.png', '总览预览.png')
    for extra in sorted(root.glob('小红书*.txt')):
        z.write(extra, extra.name)
with zipfile.ZipFile(zip_path) as z:
    if z.testzip() is not None:
        print('FAIL zip 损坏')
        raise SystemExit(1)
    print('OK')
    for info in z.infolist():
        print(f' - {info.filename} ({info.file_size/1024:.0f} KB)')
    print(f'输出: {zip_path} ({zip_path.stat().st_size/1024/1024:.2f} MB)')
