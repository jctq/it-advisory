#!/usr/bin/env python3
"""
Regenerates TECHMD brand assets from masters in `public/brand/_source/`.

- **Light** (`techmd-logo-master.*`): full, compact, mark, SVG wrappers, native app icons.
- **Dark** (`techmd-logo-master-dark.*`): same crops from the dark-mode master (keys navy backdrop
  to alpha). Falls back to programmatic recolor of light assets when no dark master exists.
- Picks the **best master** per mode (PNG → WebP → JPEG).
- For sources narrower than ~1800px, applies **2× supersampling** on the RGBA canvas before crops.
- Crops / tagline strip use coordinates scaled from the **1024×682** reference canvas.
- `techmd-logo-*.svg` embed the PNGs (not true Bézier SVG—export vectors from design for that).
- **Favicons:** square PNGs at 16–512px from each mark (`techmd-mark-{size}.png`, `*-dark`).

Requires: pip install pillow numpy

Usage (from repo root):
  python3 scripts/generate-techmd-brand-assets.py [path-to-light-master]
  python3 scripts/generate-techmd-brand-assets.py --light [path-to-light-master]
  python3 scripts/generate-techmd-brand-assets.py --dark [path-to-dark-master]

**Quality ceiling:** raster output cannot exceed the master. For print / retina, add
`techmd-logo-master.png` at **2400px+** width (lossless) in `_source/` and re-run.
"""

from __future__ import annotations

import hashlib
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
# Dark-mode recolor (fallback when no dark master) at N× then downscale.
DARK_RECOLOR_SUPERSAMPLE_FACTOR = 3
DARK_BACKDROP_KEY_DISTANCE = 32.0
LIGHT_BACKDROP_KEY_DISTANCE = 42.0
LIGHT_BACKDROP_ALPHA_BLUR_RADIUS = 0.75
FAVICON_SIZES_PX = (16, 32, 48, 180, 192, 512)
LOSSY_SOURCE_SUFFIXES = {".jpg", ".jpeg"}


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


def resolve_dark_source_path(cli_path: Path | None) -> Path | None:
    if cli_path is not None and cli_path.is_file():
        return cli_path
    for name in (
        "techmd-logo-master-dark.png",
        "techmd-logo-master-dark.webp",
        "techmd-logo-master-dark.jpg",
        "techmd-logo-master-dark.jpeg",
    ):
        candidate = SOURCE_DIR / name
        if candidate.is_file():
            return candidate
    return None


def is_lossy_raster_source(path: Path) -> bool:
    return path.suffix.lower() in LOSSY_SOURCE_SUFFIXES


def load_transparent_from_light_backdrop(path: Path) -> Image.Image:
    """
    Key light/white backdrop to transparent alpha (corner-sampled, soft matte).

    JPEG masters get a mild median pass and skip later 2× supersampling so block
    edges are not enlarged. Prefer `techmd-logo-master.png` (lossless) in `_source/`.
    """
    im = Image.open(path).convert("RGBA")
    if is_lossy_raster_source(path):
        im = im.filter(ImageFilter.MedianFilter(size=3))
    arr = np.array(im).astype(np.float32)
    h, w = arr.shape[0], arr.shape[1]
    corners = np.array(
        [
            arr[0, 0, :3],
            arr[0, w - 1, :3],
            arr[h - 1, 0, :3],
            arr[h - 1, w - 1, :3],
        ],
        dtype=np.float32,
    )
    backdrop = np.median(corners, axis=0)
    rgb = arr[:, :, :3]
    distance = np.sqrt(np.sum((rgb - backdrop) ** 2, axis=2))
    edge0 = 10.0
    edge1 = LIGHT_BACKDROP_KEY_DISTANCE
    t = np.clip((distance - edge0) / max(edge1 - edge0, 1.0), 0.0, 1.0)
    ink_weight = _smoothstep01(t)
    ink_weight = _blur_ink_weight_map(ink_weight, radius=LIGHT_BACKDROP_ALPHA_BLUR_RADIUS)
    out = arr.copy()
    out[:, :, 3] = np.clip(ink_weight * 255.0, 0.0, 255.0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def load_transparent_from_dark_backdrop(path: Path) -> Image.Image:
    """Key uniform navy backdrop (corner-sampled) to transparent alpha."""
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[0], arr.shape[1]
    corners = np.array(
        [
            arr[0, 0, :3],
            arr[0, w - 1, :3],
            arr[h - 1, 0, :3],
            arr[h - 1, w - 1, :3],
        ],
        dtype=np.float32,
    )
    backdrop = np.median(corners, axis=0)
    rgb = arr[:, :, :3].astype(np.float32)
    distance = np.sqrt(np.sum((rgb - backdrop) ** 2, axis=2))
    is_backdrop = distance < DARK_BACKDROP_KEY_DISTANCE
    arr[:, :, 3] = np.where(is_backdrop, 0, arr[:, :, 3])
    return Image.fromarray(arr, "RGBA")


def maybe_supersample(im: Image.Image) -> Image.Image:
    """Upsample small working canvases so later resizes low-pass soft edges slightly."""
    if im.width >= SUPERSAMPLE_IF_WIDTH_BELOW_PX:
        return im
    w, h = im.size
    f = SUPERSAMPLE_FACTOR
    return im.resize((w * f, h * f), Image.Resampling.LANCZOS)


def maybe_supersample_for_source(source: Path, im: Image.Image) -> Image.Image:
    """Do not 2× JPEG sources — upscaling enlarges compression blocks and halos."""
    if is_lossy_raster_source(source):
        return im
    return maybe_supersample(im)


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


def write_logo_svg(im: Image.Image, png_name: str, svg_path: Path, aria_label: str = "TECHMD") -> None:
    w, h = im.size
    svg_path.write_text(
        (
            '<svg xmlns="http://www.w3.org/2000/svg" '
            'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img" aria-label="{aria_label}">\n'
            f'  <image xlink:href="{png_name}" href="{png_name}" '
            'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />\n'
            "</svg>\n"
        ),
        encoding="utf-8",
    )


def write_mark_favicons(mark: Image.Image, name_prefix: str, out_dir: Path) -> None:
    """Square PNG favicons / PWA icons from a trimmed mark."""
    for side in FAVICON_SIZES_PX:
        inner = scale_to_max(mark, max(1, side - 12))
        square = pad_center_square(inner, side)
        save_png_optimized(square, out_dir / f"{name_prefix}-{side}x{side}.png")


def build_variants_from_master(
    loader,
    source: Path,
    *,
    label: str,
) -> tuple[Image.Image, Image.Image, Image.Image]:
    base_raw = loader(source)
    base = maybe_supersample_for_source(source, base_raw)
    if base_raw.width < 1600:
        print(
            f"Note ({label}): master width {base_raw.width}px is modest—add a 2400px+ PNG to "
            f"{SOURCE_DIR}/ for maximum sharpness.",
            file=sys.stderr,
        )
    if label == "light" and is_lossy_raster_source(source):
        print(
            f"Note ({label}): master is JPEG ({source.name})—use techmd-logo-master.png in "
            f"{SOURCE_DIR}/ for sharp edges (matches dark master quality).",
            file=sys.stderr,
        )
    full_src = trim_transparent(base, pad=2)
    compact_src = trim_transparent(strip_tagline_for_compact(base), pad=2)
    mark_src = trim_transparent(base.crop(mark_crop_box_px(base)), pad=2)
    return full_src, compact_src, mark_src


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


def write_brand_asset_version(web_brand: Path) -> str:
    """Fingerprint masters so browsers and Next image cache pick up replacements."""
    parts: list[str] = []
    for path in sorted(SOURCE_DIR.glob("techmd-logo-master*")):
        if path.is_file():
            stat = path.stat()
            parts.append(f"{path.name}:{stat.st_mtime_ns}:{stat.st_size}")
    version = hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]
    ts_path = REPO / "apps/web/src/lib/brand/brand-assets.ts"
    ts_path.parent.mkdir(parents=True, exist_ok=True)
    ts_path.write_text(
        (
            "/** Auto-generated by scripts/generate-techmd-brand-assets.py — do not edit manually. */\n"
            f"export const BRAND_ASSET_VERSION = '{version}' as const;\n\n"
            "export const BRAND_LOGO_FULL_LIGHT = 'techmd-logo-full.png' as const;\n"
            "export const BRAND_LOGO_COMPACT_LIGHT = 'techmd-logo-compact.png' as const;\n"
            "export const BRAND_LOGO_FULL_DARK = 'techmd-logo-full-dark.png' as const;\n"
            "export const BRAND_LOGO_COMPACT_DARK = 'techmd-logo-compact-dark.png' as const;\n"
            "export const BRAND_MARK_LIGHT = 'techmd-mark.png' as const;\n"
            "export const BRAND_MARK_DARK = 'techmd-mark-dark.png' as const;\n\n"
            "/** Public URL for a brand raster under `/brand/`, with a cache-busting query param. */\n"
            "export function brandAssetUrl(fileName: string): string {\n"
            "  const normalized = fileName.startsWith('/brand/') ? fileName.slice('/brand/'.length) : fileName;\n"
            f"  return `/brand/${{normalized}}?v=${{BRAND_ASSET_VERSION}}`;\n"
            "}\n"
        ),
        encoding="utf-8",
    )
    (web_brand / "asset-version.txt").write_text(f"{version}\n", encoding="utf-8")
    return version


def parse_cli_paths() -> tuple[Path | None, Path | None, bool, bool]:
    """Returns (light_cli, dark_cli, light_only_flag, dark_only_flag)."""
    args = sys.argv[1:]
    light_only = False
    dark_only = False
    if args and args[0] == "--light":
        light_only = True
        args = args[1:]
    elif args and args[0] == "--dark":
        dark_only = True
        args = args[1:]
    light_cli = None
    dark_cli = None
    if dark_only:
        dark_cli = Path(args[0]) if args else None
    elif light_only:
        light_cli = Path(args[0]) if args else None
    elif len(args) == 1:
        light_cli = Path(args[0])
    return light_cli, dark_cli, light_only, dark_only


def main() -> None:
    light_cli, dark_cli, light_only, dark_only = parse_cli_paths()
    web_brand = REPO / "apps/web/public/brand"
    full_web: Image.Image | None = None
    compact_web: Image.Image | None = None
    mark_web: Image.Image | None = None
    if not dark_only:
        source = resolve_source_path(light_cli)
        if not source.is_file():
            print(f"Light source not found: {source}", file=sys.stderr)
            sys.exit(1)
        full_src, compact_src, mark_src = build_variants_from_master(
            load_transparent_from_light_backdrop, source, label="light"
        )
        full_web = scale_to_max_width(full_src, WEB_LOGO_MAX_WIDTH_PX)
        compact_web = scale_to_max_width(compact_src, WEB_LOGO_MAX_WIDTH_PX)
        mark_web = scale_to_max_width(mark_src, MARK_WEB_MAX_WIDTH_PX)
        save_png_optimized(full_web, web_brand / "techmd-logo-full.png")
        save_png_optimized(compact_web, web_brand / "techmd-logo-compact.png")
        save_png_optimized(mark_web, web_brand / "techmd-mark.png")
        write_logo_svg(full_web, "techmd-logo-full.png", web_brand / "techmd-logo-full.svg")
        write_logo_svg(compact_web, "techmd-logo-compact.png", web_brand / "techmd-logo-compact.svg")
        write_mark_favicons(mark_web, "techmd-mark", web_brand)
        native = REPO / "apps/native/assets"
        expo_icon = scale_to_max(mark_src, 900)
        save_png_optimized(pad_center_square(expo_icon, 1024), native / "icon.png")
        adaptive = scale_to_max(mark_src, 660)
        save_png_optimized(pad_center_square(adaptive, 1024), native / "adaptive-icon.png")
        splash_logo = scale_to_max(full_src, 900)
        save_png_optimized(pad_center_square(splash_logo, 1024), native / "splash-icon.png")
        save_png_optimized(pad_center_square(scale_to_max(mark_src, 256), 256), native / "favicon.png")
        print(f"Light assets from master: {source.name}")
    dark_source = resolve_dark_source_path(dark_cli)
    if light_only:
        dark_source = None
    if dark_source is not None and dark_source.is_file():
        full_dark_src, compact_dark_src, mark_dark_src = build_variants_from_master(
            load_transparent_from_dark_backdrop, dark_source, label="dark"
        )
        full_dark_web = scale_to_max_width(full_dark_src, WEB_LOGO_MAX_WIDTH_PX)
        compact_dark_web = scale_to_max_width(compact_dark_src, WEB_LOGO_MAX_WIDTH_PX)
        mark_dark_web = scale_to_max_width(mark_dark_src, MARK_WEB_MAX_WIDTH_PX)
        save_png_optimized(full_dark_web, web_brand / "techmd-logo-full-dark.png")
        save_png_optimized(compact_dark_web, web_brand / "techmd-logo-compact-dark.png")
        save_png_optimized(mark_dark_web, web_brand / "techmd-mark-dark.png")
        write_logo_svg(
            full_dark_web,
            "techmd-logo-full-dark.png",
            web_brand / "techmd-logo-full-dark.svg",
        )
        write_logo_svg(
            compact_dark_web,
            "techmd-logo-compact-dark.png",
            web_brand / "techmd-logo-compact-dark.svg",
        )
        write_mark_favicons(mark_dark_web, "techmd-mark-dark", web_brand)
        print(f"Dark assets from master: {dark_source.name}")
    elif not light_only and not dark_only and full_web is not None and compact_web is not None and mark_web is not None:
        save_png_optimized(
            supersampled_recolor_for_dark_ui(full_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR),
            web_brand / "techmd-logo-full-dark.png",
        )
        save_png_optimized(
            supersampled_recolor_for_dark_ui(compact_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR),
            web_brand / "techmd-logo-compact-dark.png",
        )
        mark_dark_fallback = supersampled_recolor_for_dark_ui(mark_web, DARK_RECOLOR_SUPERSAMPLE_FACTOR)
        save_png_optimized(mark_dark_fallback, web_brand / "techmd-mark-dark.png")
        write_mark_favicons(mark_dark_fallback, "techmd-mark-dark", web_brand)
        print("Dark assets from programmatic recolor (no dark master in _source/)", file=sys.stderr)
    elif dark_only:
        print("Dark source not found in _source/ (techmd-logo-master-dark.*)", file=sys.stderr)
        sys.exit(1)
    elif light_only and full_web is None:
        print("Light source not found in _source/ (techmd-logo-master.*)", file=sys.stderr)
        sys.exit(1)
    version = write_brand_asset_version(web_brand)
    print(f"Wrote TECHMD assets to apps/web/public/brand and apps/native/assets (v={version})")


if __name__ == "__main__":
    main()
