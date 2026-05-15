#!/usr/bin/env python3
"""
Regenerates TECHMD brand assets from `public/brand/_source/techmd-logo-master.*`

- Picks the **best master** in `_source/` (PNG → WebP → JPEG).
- For sources narrower than ~1800px, applies **2× supersampling** on the RGBA canvas
  before crops (reduces JPEG blockiness before downscale; does not add real detail beyond
  what a higher-res master would).
- Crops / tagline strip use coordinates scaled from the **1024×682** reference canvas so
  larger masters still align.
- `techmd-logo-*.svg` embed the PNGs (not true Bézier SVG—export vectors from design for that).
- **Dark (`*-dark.png`)** variants: supersampled recolor, smoothed blend mask, linear RGB blend,
  and a luminance guard so small tagline text is not tinted; still prefer a high-res lossless master.

Requires: pip install pillow numpy

Usage (from repo root):
  python3 scripts/generate-techmd-brand-assets.py [path-to-source-image]

**Quality ceiling:** raster output cannot exceed the master. For print / retina, add
`techmd-logo-master.png` at **2400px+** width (lossless) in `_source/` and re-run.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO / "apps/web/public/brand/_source"
# Reference canvas used when the original TECHMD master was 1024×682 (crop math).
REFERENCE_MASTER_WIDTH_PX = 1024
REFERENCE_MASTER_HEIGHT_PX = 682
MARK_CROP_LEFT = 78
MARK_CROP_TOP = 240
MARK_CROP_RIGHT = 269
MARK_CROP_BOTTOM = 417
STRIP_TAGLINE_Y_REF = 399
STRIP_TAGLINE_X_CUT_REF = 261
SUPERSAMPLE_IF_WIDTH_BELOW_PX = 1800
SUPERSAMPLE_FACTOR = 2
WEB_LOGO_MAX_WIDTH_PX = 3200
MARK_WEB_MAX_WIDTH_PX = 1200
# Dark-mode recolor works at N× size then scales back down (reduces crawl/speckle on soft masks).
DARK_RECOLOR_SUPERSAMPLE_FACTOR = 3


def resolve_source_path(cli_path: Path | None) -> Path:
    if cli_path is not None and cli_path.is_file():
        return cli_path
    for name in (
        "techmd-logo-master.png",
        "techmd-logo-master.webp",
        "techmd-logo-master.jpg",
        "techmd-logo-master.jpeg",
    ):
        candidate = SOURCE_DIR / name
        if candidate.is_file():
            return candidate
    return SOURCE_DIR / "techmd-logo-master.jpg"


def load_transparent_rgba(path: Path) -> Image.Image:
    """Load image, lift near-white backdrop to alpha (no unsharp—avoids boosting JPEG ringing)."""
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    white = (rgb[:, :, 0] > 249) & (rgb[:, :, 1] > 249) & (rgb[:, :, 2] > 249)
    arr[:, :, 3] = np.where(white, 0, arr[:, :, 3])
    return Image.fromarray(arr, "RGBA")


def maybe_supersample(im: Image.Image) -> Image.Image:
    """Upsample small working canvases so later resizes low-pass JPEG blocks slightly."""
    if im.width >= SUPERSAMPLE_IF_WIDTH_BELOW_PX:
        return im
    w, h = im.size
    f = SUPERSAMPLE_FACTOR
    return im.resize((w * f, h * f), Image.Resampling.LANCZOS)


def trim_transparent(im: Image.Image, pad: int = 0) -> Image.Image:
    """Crop to non-transparent bounding box."""
    arr = np.array(im)
    alpha = arr[:, :, 3]
    ys = np.where(alpha > 0)[0]
    xs = np.where(alpha > 0)[1]
    if len(xs) == 0:
        return im
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    if pad > 0:
        y0 = max(0, y0 - pad)
        x0 = max(0, x0 - pad)
        y1 = min(im.height, y1 + pad)
        x1 = min(im.width, x1 + pad)
    return im.crop((x0, y0, x1, y1))


def mark_crop_box_px(im: Image.Image) -> tuple[int, int, int, int]:
    sx = im.width / REFERENCE_MASTER_WIDTH_PX
    sy = im.height / REFERENCE_MASTER_HEIGHT_PX
    left = int(MARK_CROP_LEFT * sx)
    top = int(MARK_CROP_TOP * sy)
    right = int(MARK_CROP_RIGHT * sx)
    bottom = int(MARK_CROP_BOTTOM * sy)
    return (left, top, right, bottom)


def strip_tagline_for_compact(im: Image.Image) -> Image.Image:
    """Remove tagline region (coordinates scale with canvas vs 1024×682 reference)."""
    arr = np.array(im)
    h, w = arr.shape[0], arr.shape[1]
    y0 = min(h - 1, max(0, int(STRIP_TAGLINE_Y_REF * h / REFERENCE_MASTER_HEIGHT_PX)))
    x_cut = min(w - 1, max(0, int(STRIP_TAGLINE_X_CUT_REF * w / REFERENCE_MASTER_WIDTH_PX)))
    for y in range(y0, h):
        arr[y, x_cut + 1 :, 3] = 0
    return Image.fromarray(arr, "RGBA")


def scale_to_max(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return im
    scale = max_side / m
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def scale_to_max_width(im: Image.Image, max_width: int) -> Image.Image:
    w, h = im.size
    if w <= max_width:
        return im
    scale = max_width / w
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def pad_center_square(im: Image.Image, side: int) -> Image.Image:
    w, h = im.size
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = (side - h) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas


def save_png_optimized(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True, compress_level=6)


def _smoothstep01(x: np.ndarray) -> np.ndarray:
    """Gentler 0..1 ramp than linear (reduces banding on recolor edges)."""
    t = np.clip(x, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _srgb_byte_to_linear(channel: np.ndarray) -> np.ndarray:
    x = np.clip(channel / 255.0, 0.0, 1.0)
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _linear_byte_to_srgb(channel: np.ndarray) -> np.ndarray:
    x = np.clip(channel, 0.0, 1.0)
    s = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1.0 / 2.4) - 0.055)
    return s * 255.0


def _blur_ink_weight_map(ink_weight: np.ndarray, radius: float) -> np.ndarray:
    """Low-pass JPEG speckle on the blend mask (not on color), keeps edges softer."""
    layer = (np.clip(ink_weight, 0.0, 1.0) * 255.0).astype(np.uint8)
    blurred = np.asarray(Image.fromarray(layer, mode="L").filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
    return blurred / 255.0


def recolor_dark_ink_for_dark_ui(im: Image.Image) -> Image.Image:
    """
    Lighten navy/gray ink for dark UI backgrounds.

    JPEG noise + per-pixel weights causes \"speckled\" halos on dark mode; we smooth the
    weight map, blend in linear sRGB, and guard near-white pixels (taglines) from being tinted.
    """
    arr = np.array(im).astype(np.float32)
    r_channel = arr[:, :, 0]
    g_channel = arr[:, :, 1]
    b_channel = arr[:, :, 2]
    alpha = arr[:, :, 3]
    luminance = 0.2126 * r_channel + 0.7152 * g_channel + 0.0722 * b_channel
    lum_lo = 68.0
    lum_hi = 178.0
    t = (lum_hi - luminance) / (lum_hi - lum_lo)
    ink_weight = _smoothstep01(t)
    ink_weight = ink_weight * np.clip(alpha / 255.0, 0.0, 1.0)
    tagline_guard = 1.0 - _smoothstep01((luminance - 172.0) / 48.0)
    ink_weight = ink_weight * tagline_guard
    ink_weight = _blur_ink_weight_map(ink_weight, radius=0.85)
    navy_hint = np.clip((b_channel - 0.5 * (r_channel + g_channel)) / 36.0 + 0.5, 0.0, 1.0)
    navy_hint = _smoothstep01(navy_hint)
    navy_hint = _blur_ink_weight_map(navy_hint, radius=0.45)
    light_blue = np.array([191.0, 219.0, 254.0], dtype=np.float32)
    light_muted = np.array([228.0, 231.0, 236.0], dtype=np.float32)
    target = (
        light_muted[np.newaxis, np.newaxis, :] * (1.0 - navy_hint)[..., np.newaxis]
        + light_blue[np.newaxis, np.newaxis, :] * navy_hint[..., np.newaxis]
    )
    base_lin = np.stack(
        [_srgb_byte_to_linear(r_channel), _srgb_byte_to_linear(g_channel), _srgb_byte_to_linear(b_channel)],
        axis=-1,
    )
    target_lin = np.stack(
        [_srgb_byte_to_linear(target[..., 0]), _srgb_byte_to_linear(target[..., 1]), _srgb_byte_to_linear(target[..., 2])],
        axis=-1,
    )
    w = ink_weight[..., np.newaxis]
    blended_lin = base_lin * (1.0 - w) + target_lin * w
    out = arr.copy()
    out[:, :, 0] = _linear_byte_to_srgb(blended_lin[:, :, 0])
    out[:, :, 1] = _linear_byte_to_srgb(blended_lin[:, :, 1])
    out[:, :, 2] = _linear_byte_to_srgb(blended_lin[:, :, 2])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def supersampled_recolor_for_dark_ui(im: Image.Image, up_factor: int = 2) -> Image.Image:
    """Recolor at higher resolution then scale down to suppress edge crawl from a soft mask."""
    if up_factor <= 1:
        return recolor_dark_ink_for_dark_ui(im)
    w, h = im.size
    hi = im.resize((w * up_factor, h * up_factor), Image.Resampling.LANCZOS)
    rec = recolor_dark_ink_for_dark_ui(hi)
    return rec.resize((w, h), Image.Resampling.LANCZOS)


def main() -> None:
    cli = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    source = resolve_source_path(cli)
    if not source.is_file():
        print(f"Source not found: {source}", file=sys.stderr)
        sys.exit(1)
    base_raw = load_transparent_rgba(source)
    base = maybe_supersample(base_raw)
    if base_raw.width < 1600:
        print(
            f"Note: master width {base_raw.width}px is modest—add a 2400px+ PNG to "
            f"{SOURCE_DIR}/techmd-logo-master.png for maximum sharpness.",
            file=sys.stderr,
        )
    full_src = trim_transparent(base, pad=2)
    compact_src = trim_transparent(strip_tagline_for_compact(base), pad=2)
    mark_src = trim_transparent(base.crop(mark_crop_box_px(base)), pad=2)
    web_brand = REPO / "apps/web/public/brand"
    full_web = scale_to_max_width(full_src, WEB_LOGO_MAX_WIDTH_PX)
    compact_web = scale_to_max_width(compact_src, WEB_LOGO_MAX_WIDTH_PX)
    mark_web = scale_to_max_width(mark_src, MARK_WEB_MAX_WIDTH_PX)
    save_png_optimized(full_web, web_brand / "techmd-logo-full.png")
    save_png_optimized(compact_web, web_brand / "techmd-logo-compact.png")
    save_png_optimized(mark_web, web_brand / "techmd-mark.png")
    save_png_optimized(supersampled_recolor_for_dark_ui(full_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR), web_brand / "techmd-logo-full-dark.png")
    save_png_optimized(supersampled_recolor_for_dark_ui(compact_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR), web_brand / "techmd-logo-compact-dark.png")
    save_png_optimized(supersampled_recolor_for_dark_ui(mark_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR), web_brand / "techmd-mark-dark.png")
    full_w, full_h = full_web.size
    compact_w, compact_h = compact_web.size
    (web_brand / "techmd-logo-full.svg").write_text(
        (
            '<svg xmlns="http://www.w3.org/2000/svg" '
            'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{full_w}" height="{full_h}" viewBox="0 0 {full_w} {full_h}" '
            'role="img" aria-label="TECHMD">\n'
            '  <image xlink:href="techmd-logo-full.png" href="techmd-logo-full.png" '
            'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />\n'
            "</svg>\n"
        ),
        encoding="utf-8",
    )
    (web_brand / "techmd-logo-compact.svg").write_text(
        (
            '<svg xmlns="http://www.w3.org/2000/svg" '
            'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{compact_w}" height="{compact_h}" viewBox="0 0 {compact_w} {compact_h}" '
            'role="img" aria-label="TECHMD">\n'
            '  <image xlink:href="techmd-logo-compact.png" href="techmd-logo-compact.png" '
            'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />\n'
            "</svg>\n"
        ),
        encoding="utf-8",
    )
    native = REPO / "apps/native/assets"
    expo_icon = scale_to_max(mark_src, 900)
    save_png_optimized(pad_center_square(expo_icon, 1024), native / "icon.png")
    adaptive = scale_to_max(mark_src, 660)
    save_png_optimized(pad_center_square(adaptive, 1024), native / "adaptive-icon.png")
    splash_logo = scale_to_max(full_src, 900)
    save_png_optimized(pad_center_square(splash_logo, 1024), native / "splash-icon.png")
    print("Wrote TECHMD assets to apps/web/public/brand and apps/native/assets")


if __name__ == "__main__":
    main()
