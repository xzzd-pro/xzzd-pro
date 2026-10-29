"""Build the brand font used by the extension.

Keeps Latin, common punctuation and the 6,763 GB2312 hanzi, then writes WOFF2.
Characters outside the subset fall back to the system font.

    pip install fonttools brotli
    python scripts/subset-font.py [src/assets/lxgw-wen-kai-screen.ttf]
"""

import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "src/assets/lxgw-wen-kai-screen.ttf"
TARGET = ROOT / "src/assets/fonts/lxgw-wen-kai-screen.woff2"

RANGES = [
    (0x0020, 0x007E),  # Basic Latin
    (0x00A0, 0x00FF),  # Latin-1 Supplement
    (0x0370, 0x03FF),  # Greek (math symbols in course text)
    (0x2000, 0x206F),  # General Punctuation
    (0x2100, 0x214F),  # Letterlike Symbols
    (0x2190, 0x21FF),  # Arrows
    (0x2200, 0x22FF),  # Mathematical Operators
    (0x2460, 0x24FF),  # Enclosed Alphanumerics
    (0x3000, 0x303F),  # CJK Symbols and Punctuation
    (0xFF00, 0xFFEF),  # Halfwidth and Fullwidth Forms
]


def gb2312_hanzi() -> set[int]:
    chars = set()
    for high in range(0xB0, 0xF8):
        for low in range(0xA1, 0xFF):
            try:
                chars.add(ord(bytes([high, low]).decode("gb2312")))
            except UnicodeDecodeError:
                pass
    return chars


def main() -> None:
    unicodes = gb2312_hanzi()
    for start, end in RANGES:
        unicodes.update(range(start, end + 1))

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False

    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(TARGET), options)
    print(f"{SOURCE.name}: {SOURCE.stat().st_size:,} B -> {TARGET.name}: {TARGET.stat().st_size:,} B")


if __name__ == "__main__":
    main()
