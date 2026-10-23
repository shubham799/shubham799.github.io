#!/usr/bin/env python3
"""
Generates the Open Graph preview image: assets/og.png (1200 x 630).

Text comes from index.html so the image stays in sync with the site:
  - name     <- <h1 id="hero-title">
  - title    <- the hero's small label (<p class="label">)
  - tagline  <- <p class="hero__intro">

Usage (from the repo root):
    pip install pillow
    python3 scripts/make-og-image.py

Fonts (Bricolage Grotesque, Hanken Grotesk, Geist Mono) are downloaded from
Google Fonts into scripts/.font-cache/ on first run. If that fails, system
fonts are used instead.
"""

import html
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUTPUT = ROOT / "assets" / "og.png"
FONT_CACHE = Path(__file__).resolve().parent / ".font-cache"

# ---------- Design tokens (match css/style.css) ----------
BG = "#f0eeeb"
INK = "#302e2d"
INK_MUTED = "#66615d"
ACCENT = "#006838"
BORDER = "#e4e0dc"

WIDTH, HEIGHT = 1200, 630
SCALE = 2          # draw at 2x, then downsample for smoother edges
MARGIN_X = 96      # platforms crop edges; keep >= 80 on every side
MARGIN_Y = 84
URL_LABEL = "shubham799.github.io"

# ---------- Fonts ----------
# Each entry: Google Fonts css2 query, then system fallbacks (macOS, Linux).
FONTS = {
    "heading": ("Bricolage+Grotesque:opsz,wght@96,700",
                ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]),
    "body":    ("Hanken+Grotesk:wght@400",
                ["/System/Library/Fonts/Supplemental/Arial.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]),
    "body_medium": ("Hanken+Grotesk:wght@500",
                ["/System/Library/Fonts/Supplemental/Arial.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]),
    "mono":    ("Geist+Mono:wght@500",
                ["/System/Library/Fonts/Menlo.ttc",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]),
}


def font_path(key):
    """Return a local .ttf path for a font key, downloading it if needed."""
    query, fallbacks = FONTS[key]
    cached = FONT_CACHE / f"{key}.ttf"
    if cached.exists():
        return cached
    try:
        # A plain User-Agent makes Google Fonts serve TTF (Pillow can't read WOFF2)
        req = urllib.request.Request(
            f"https://fonts.googleapis.com/css2?family={query}",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        css = urllib.request.urlopen(req, timeout=15).read().decode()
        ttf_url = re.search(r"url\((https://[^)]+\.ttf)\)", css).group(1)
        FONT_CACHE.mkdir(exist_ok=True)
        cached.write_bytes(urllib.request.urlopen(ttf_url, timeout=30).read())
        return cached
    except Exception as err:
        print(f"  ! could not download {key} font ({err}); using a system fallback")
    for path in fallbacks:
        if Path(path).exists():
            return Path(path)
    return None


def load_font(key, size):
    path = font_path(key)
    if path is None:
        return ImageFont.load_default(size=size)
    return ImageFont.truetype(str(path), size)


# ---------- Content from index.html ----------
def clean(fragment):
    """Strip tags, decode entities and collapse whitespace."""
    text = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def read_content():
    source = INDEX.read_text(encoding="utf-8")
    hero = re.search(r'<section class="hero[^"]*"[^>]*>(.*?)</section>', source, re.S)
    if not hero:
        sys.exit("Could not find the hero <section> in index.html")
    hero = hero.group(1)

    def pick(pattern, label):
        match = re.search(pattern, hero, re.S)
        if not match:
            sys.exit(f"Could not find the {label} in index.html's hero")
        return clean(match.group(1))

    return {
        "name": pick(r'<h1[^>]*id="hero-title"[^>]*>(.*?)</h1>', "name (h1#hero-title)"),
        "title": pick(r'<p class="label">(.*?)</p>', "title (p.label)"),
        "tagline": pick(r'<p class="hero__intro">(.*?)</p>', "tagline (p.hero__intro)"),
    }


# ---------- Drawing helpers ----------
def text_width(font, text, tracking=0.0):
    return font.getlength(text) + tracking * max(len(text) - 1, 0)


def draw_tracked(draw, xy, text, font, fill, tracking=0.0):
    """Draw text at a left-baseline position with extra letter-spacing (px)."""
    x, y = xy
    if not tracking:
        draw.text((x, y), text, font=font, fill=fill, anchor="ls")
        return
    for i, char in enumerate(text):
        # getlength of the prefix keeps the font's own spacing between letters
        draw.text((x + font.getlength(text[:i]) + tracking * i, y), char,
                  font=font, fill=fill, anchor="ls")


def wrap(font, text, max_width):
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if font.getlength(candidate) <= max_width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def main():
    content = read_content()
    print(f"  name:    {content['name']}")
    print(f"  title:   {content['title']}")
    print(f"  tagline: {content['tagline']}")

    s = SCALE
    img = Image.new("RGB", (WIDTH * s, HEIGHT * s), BG)
    draw = ImageDraw.Draw(img)

    # Hairline frame, inset from the edge
    inset = 28 * s
    draw.rounded_rectangle(
        (inset, inset, WIDTH * s - inset, HEIGHT * s - inset),
        radius=18 * s, outline=BORDER, width=2 * s // 2 or 1,
    )

    content_width = (WIDTH - 2 * MARGIN_X) * s
    left = MARGIN_X * s

    # Name: as large as fits, tight letter-spacing like the site headings
    name_size = 112
    while True:
        name_font = load_font("heading", name_size * s)
        name_tracking = -0.035 * name_size * s
        if text_width(name_font, content["name"], name_tracking) <= content_width or name_size <= 60:
            break
        name_size -= 4

    title_font = load_font("body_medium", 36 * s)
    tagline_font = load_font("body", 28 * s)
    mono_font = load_font("mono", 22 * s)

    # Tagline: up to 3 lines; otherwise use the part before the em dash
    tagline_lines = wrap(tagline_font, content["tagline"], 880 * s)
    if len(tagline_lines) > 3:
        short = re.split(r"\s+[—–-]\s+", content["tagline"])[0].rstrip(".,") + "."
        tagline_lines = wrap(tagline_font, short, 880 * s)[:3]

    # Vertical layout (baselines), block starts below the top margin
    name_ascent = name_font.getmetrics()[0]
    y = MARGIN_Y * s + name_ascent - 10 * s
    draw_tracked(draw, (left, y), content["name"], name_font, INK, name_tracking)

    # Short green underline under the name
    y += 30 * s
    draw.rounded_rectangle((left, y, left + 88 * s, y + 7 * s), radius=4 * s, fill=ACCENT)

    y += 7 * s + 62 * s
    draw.text((left, y), content["title"], font=title_font, fill=INK, anchor="ls")

    y += 58 * s
    for line in tagline_lines:
        draw.text((left, y), line, font=tagline_font, fill=INK_MUTED, anchor="ls")
        y += 42 * s

    # URL label, bottom-left, in the accent colour
    url_y = (HEIGHT - MARGIN_Y) * s
    if y - 42 * s + 20 * s > url_y - 40 * s:
        print("  ! text block is close to the URL label; consider a shorter tagline")
    draw_tracked(draw, (left, url_y), URL_LABEL, mono_font, ACCENT, 0.02 * 22 * s)

    OUTPUT.parent.mkdir(exist_ok=True)
    img.resize((WIDTH, HEIGHT), Image.LANCZOS).save(OUTPUT, "PNG", optimize=True)
    print(f"  saved {OUTPUT.relative_to(ROOT)} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
