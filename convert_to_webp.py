# WebP一括変換スクリプト
# 必要なライブラリのインストール:
#   pip install Pillow pillow-heif

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("エラー: Pillowがインストールされていません。")
    print("実行してください: pip install Pillow pillow-heif")
    exit(1)

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    heif_available = True
except ImportError:
    heif_available = False
    print("警告: pillow-heifが見つかりません。HEICファイルはスキップされます。")
    print("HEICも変換したい場合: pip install pillow-heif")

# 設定
TARGET_DIR = r"C:\homepage\洗車4月"
MAX_WIDTH = 1200
WEBP_QUALITY = 85  # 80〜90が品質と軽量のバランスが良い
TARGET_EXTS = {".heic", ".jpg", ".jpeg"}

def convert_image(src_path: Path) -> None:
    dst_path = src_path.with_suffix(".webp")

    if dst_path.exists():
        print(f"  スキップ（既存）: {dst_path.name}")
        return

    try:
        with Image.open(src_path) as img:
            # EXIF回転を自動補正
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # RGBAはRGBに変換（WebPはRGBA対応だが念のためJPG由来はRGBに）
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            # 横幅が1200pxを超える場合だけリサイズ
            if img.width > MAX_WIDTH:
                ratio = MAX_WIDTH / img.width
                new_size = (MAX_WIDTH, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)
                print(f"  リサイズ: {src_path.name} → {new_size[0]}x{new_size[1]}")

            img.save(dst_path, "webp", quality=WEBP_QUALITY, method=6)
            src_kb = src_path.stat().st_size / 1024
            dst_kb = dst_path.stat().st_size / 1024
            print(f"  変換完了: {src_path.name} → {dst_path.name}  ({src_kb:.0f}KB → {dst_kb:.0f}KB)")

    except Exception as e:
        print(f"  エラー: {src_path.name} — {e}")

def main():
    folder = Path(TARGET_DIR)
    if not folder.exists():
        print(f"フォルダが見つかりません: {TARGET_DIR}")
        return

    targets = [
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in TARGET_EXTS
    ]

    if not targets:
        print("対象ファイルが見つかりませんでした。")
        return

    print(f"対象ファイル数: {len(targets)}")
    print("-" * 50)

    for path in sorted(targets):
        if path.suffix.lower() == ".heic" and not heif_available:
            print(f"  スキップ（pillow-heif未導入）: {path.name}")
            continue
        convert_image(path)

    print("-" * 50)
    print("完了しました。")

if __name__ == "__main__":
    main()
