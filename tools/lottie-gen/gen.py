#!/usr/bin/env python3
"""
Single source of truth for the "List + Search" icon animation.

Defines the animation once (layers, primitives, keyframed transforms with
cubic-bezier easing) and emits BOTH:
  - public/icons/list-search.json  -> a player-ready Lottie (bodymovin) file
  - public/icons/list-search.gif   -> a faithful raster preview

Because both outputs are derived from the same spec, the GIF is an accurate
preview of the Lottie. Only transform-based animation is used (anchor /
position / scale / rotation / opacity) so the rasteriser stays generic and
matches lottie-web's behaviour.

Run:  python3 tools/lottie-gen/gen.py
"""

import json
import math
import os

from PIL import Image

# ----------------------------------------------------------------------------
# Canvas / timing
# ----------------------------------------------------------------------------
W = H = 512
FPS = 50
DUR = 150            # frames -> 3.0 s, seamless loop
SS = 2               # supersampling factor for anti-aliasing
GIF_SIZE = 480       # final gif edge (px)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "public", "icons"))

# ----------------------------------------------------------------------------
# Palette (0-255)
# ----------------------------------------------------------------------------
CARD = (14, 17, 23)          # #0E1117 dark tile
LINE = (215, 222, 232)       # #D7DEE8 light list rows
TEAL = (0, 221, 179)         # #00DDB3 accent (magnifier)
GLASS = (0, 221, 179)        # lens fill (low alpha)


def hexf(c):
    """255-tuple -> Lottie 0..1 float list."""
    return [round(v / 255.0, 5) for v in c]


# ----------------------------------------------------------------------------
# Easing presets -> cubic-bezier control handles (out of A, into B)
# ----------------------------------------------------------------------------
EASE = {
    "linear":    None,
    "out":       (0.16, 0.84, 0.34, 1.0),   # soft slow-out
    "in":        (0.42, 0.0, 0.92, 0.30),
    "inout":     (0.62, 0.0, 0.30, 1.0),    # punchy ease-in-out
    "softinout": (0.45, 0.0, 0.30, 1.0),
}


def cubic_bezier_y_at_x(p1x, p1y, p2x, p2y, x):
    """Solve a CSS-style cubic-bezier (0,0)-(p1)-(p2)-(1,1) for y given x."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0

    def bx(t):
        u = 1 - t
        return 3 * u * u * t * p1x + 3 * u * t * t * p2x + t ** 3

    def by(t):
        u = 1 - t
        return 3 * u * u * t * p1y + 3 * u * t * t * p2y + t ** 3

    # bisection on t (robust, plenty precise for rendering)
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if bx(mid) < x:
            lo = mid
        else:
            hi = mid
    return by((lo + hi) / 2)


def ease_frac(name, f):
    """Eased fraction in [0,1] for normalised linear fraction f."""
    h = EASE[name]
    if h is None:
        return f
    return cubic_bezier_y_at_x(h[0], h[1], h[2], h[3], f)


# ----------------------------------------------------------------------------
# Keyframe helpers.  A property is either:
#   ("static", value)
#   ("anim", [(t, value, easeName), ...])    easeName = out segment of this kf
# value is a scalar or [x, y].
# ----------------------------------------------------------------------------
def static(v):
    return ("static", v)


def anim(kfs):
    return ("anim", kfs)


def _lerp(a, b, f):
    if isinstance(a, (list, tuple)):
        return [a[i] + (b[i] - a[i]) * f for i in range(len(a))]
    return a + (b - a) * f


def sample(prop, t):
    kind = prop[0]
    if kind == "static":
        return prop[1]
    kfs = prop[1]
    if t <= kfs[0][0]:
        return kfs[0][1]
    if t >= kfs[-1][0]:
        return kfs[-1][1]
    for i in range(len(kfs) - 1):
        t0, v0, ease = kfs[i]
        t1, v1, _ = kfs[i + 1]
        if t0 <= t <= t1:
            f = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return _lerp(v0, v1, ease_frac(ease, f))
    return kfs[-1][1]


# ============================================================================
# Animation spec
# ============================================================================
LINE_X = 128                 # left edge of list rows
LINE_W = [248, 286, 168]     # row widths (top, mid, bottom)
LINE_Y = [168, 248, 328]
LINE_H = 30
LINE_R = 15

LENS_R = 46                  # ring radius
LENS_SW = 26                 # ring stroke width
HANDLE_L = 64
HANDLE_T = 30

REST = [360, 372]            # lens centre at rest (bottom-right)
SCAN = [196, 168]            # lens centre over the first row


def line_layer(idx, hi_frame):
    """A list row that subtly pulses as the lens scans past it."""
    y = LINE_Y[idx]
    w = LINE_W[idx]
    cx = LINE_X + w / 2
    a = [LINE_X, y]                       # pivot at left end
    base = [LINE_X, y]
    bump = [LINE_X + 7, y]
    return {
        "nm": f"row{idx + 1}",
        "shapes": [
            {"kind": "rrect", "cx": cx, "cy": y, "w": w, "h": LINE_H,
             "r": LINE_R, "fill": LINE, "alpha": 1.0},
        ],
        "tr": {
            "a": static(a),
            "p": anim([
                (0, base, "linear"),
                (hi_frame - 8, base, "out"),
                (hi_frame, bump, "out"),
                (hi_frame + 16, base, "softinout"),
                (DUR, base, "linear"),
            ]),
            "s": anim([
                (0, [100, 100], "linear"),
                (hi_frame - 8, [100, 100], "out"),
                (hi_frame, [104, 112], "out"),
                (hi_frame + 16, [100, 100], "softinout"),
                (DUR, [100, 100], "linear"),
            ]),
            "r": static(0),
            "o": anim([
                (0, 82, "linear"),
                (hi_frame - 8, 82, "out"),
                (hi_frame, 100, "out"),
                (hi_frame + 18, 82, "softinout"),
                (DUR, 82, "linear"),
            ]),
        },
    }


def magnifier_layer():
    """Lens (ring + glass + handle) sweeping over the list then popping."""
    hx, hy = math.cos(math.radians(45)) * (LENS_R + HANDLE_L / 2 - 6), \
        math.sin(math.radians(45)) * (LENS_R + HANDLE_L / 2 - 6)
    return {
        "nm": "magnifier",
        "shapes": [
            {"kind": "ellipseFill", "cx": 0, "cy": 0, "rad": LENS_R - LENS_SW / 2,
             "fill": GLASS, "alpha": 0.16},
            {"kind": "rrect", "cx": hx, "cy": hy, "w": HANDLE_L, "h": HANDLE_T,
             "r": HANDLE_T / 2, "fill": TEAL, "alpha": 1.0, "rot": 45},
            {"kind": "ring", "cx": 0, "cy": 0, "rad": LENS_R, "w": LENS_SW,
             "stroke": TEAL, "alpha": 1.0},
        ],
        "tr": {
            "a": static([0, 0]),
            "p": anim([
                (0,   REST, "softinout"),
                (12,  REST, "inout"),
                (62,  SCAN, "inout"),
                (74,  SCAN, "inout"),
                (124, REST, "out"),
                (DUR, REST, "linear"),
            ]),
            "s": anim([
                (0,   [100, 100], "out"),
                (12,  [100, 100], "out"),
                (62,  [110, 110], "inout"),
                (124, [100, 100], "out"),
                (128, [120, 120], "out"),
                (140, [100, 100], "softinout"),
                (DUR, [100, 100], "linear"),
            ]),
            "r": anim([
                (0,   0, "softinout"),
                (62,  -10, "inout"),
                (124, 0, "softinout"),
                (DUR, 0, "linear"),
            ]),
            "o": static(100),
        },
    }


def build_spec():
    card = {
        "nm": "card",
        "shapes": [
            {"kind": "rrect", "cx": W / 2, "cy": H / 2, "w": 440, "h": 440,
             "r": 104, "fill": CARD, "alpha": 1.0},
        ],
        "tr": {"a": static([0, 0]), "p": static([0, 0]),
               "s": static([100, 100]), "r": static(0), "o": static(100)},
    }
    # lens scans up to row0 (~f62) then back down; rows light up on the
    # return sweep, top -> bottom, like results being checked off.
    rows = [line_layer(0, 96), line_layer(1, 108), line_layer(2, 120)]
    # back-to-front draw order
    return [card] + rows + [magnifier_layer()]


# ============================================================================
# Rasteriser  (PIL, supersampled)
# ============================================================================
def _rrect(draw, cx, cy, w, h, r, fill):
    draw.rounded_rectangle(
        [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=r, fill=fill)


def render_local(shapes):
    """Draw a layer's primitives (layer-local coords) at SS resolution.

    Each primitive is rasterised onto its own transparent layer and
    alpha-composited in list order, so z-order is preserved and the ring's
    destructive hole-punch stays contained to its own layer.
    """
    from PIL import ImageDraw
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    for p in shapes:
        a = int(round(p.get("alpha", 1.0) * 255))
        tmp = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
        draw = ImageDraw.Draw(tmp)
        if p["kind"] == "rrect":
            col = (*p["fill"], a)
            if p.get("rot"):
                pad = int((max(p["w"], p["h"]) + 8) * SS)
                rr = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
                ImageDraw.Draw(rr).rounded_rectangle(
                    [pad / 2 - p["w"] * SS / 2, pad / 2 - p["h"] * SS / 2,
                     pad / 2 + p["w"] * SS / 2, pad / 2 + p["h"] * SS / 2],
                    radius=p["r"] * SS, fill=col)
                rr = rr.rotate(-p["rot"], resample=Image.BICUBIC,
                               center=(pad / 2, pad / 2))
                tmp.alpha_composite(
                    rr, (int(p["cx"] * SS - pad / 2), int(p["cy"] * SS - pad / 2)))
            else:
                _rrect(draw, p["cx"] * SS, p["cy"] * SS, p["w"] * SS,
                       p["h"] * SS, p["r"] * SS, col)
        elif p["kind"] == "ellipseFill":
            col = (*p["fill"], a)
            r = p["rad"] * SS
            draw.ellipse([p["cx"] * SS - r, p["cy"] * SS - r,
                          p["cx"] * SS + r, p["cy"] * SS + r], fill=col)
        elif p["kind"] == "ring":
            # clean ring = filled outer disc with the centre erased to
            # transparent (PIL's thick ellipse outline renders rough/gappy).
            col = (*p["stroke"], a)
            cx, cy = p["cx"] * SS, p["cy"] * SS
            ro = (p["rad"] + p["w"] / 2) * SS
            ri = (p["rad"] - p["w"] / 2) * SS
            draw.ellipse([cx - ro, cy - ro, cx + ro, cy + ro], fill=col)
            draw.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=(0, 0, 0, 0))
        img.alpha_composite(tmp)
    return img


def affine_data(a, p, s, r):
    """PIL AFFINE data mapping output->input for forward: out = M*(in-a)+p."""
    th = math.radians(r)
    c, sn = math.cos(th), math.sin(th)
    sx, sy = s[0] / 100.0, s[1] / 100.0
    # M = R * S  (in SS pixel space scale stays unitless)
    m00, m01 = c * sx, -sn * sy
    m10, m11 = sn * sx, c * sy
    ax, ay = a[0] * SS, a[1] * SS
    px, py = p[0] * SS, p[1] * SS
    # forward: out = M*(in - a) + p  => in = Minv*(out - p) + a
    det = m00 * m11 - m01 * m10
    i00, i01 = m11 / det, -m01 / det
    i10, i11 = -m10 / det, m00 / det
    # in = Minv*out + (a - Minv*p)
    c0 = ax - (i00 * px + i01 * py)
    c1 = ay - (i10 * px + i11 * py)
    return (i00, i01, c0, i10, i11, c1)


def render_frame(spec, t, layer_imgs):
    frame = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    for layer, local in zip(spec, layer_imgs):
        tr = layer["tr"]
        a = sample(tr["a"], t)
        p = sample(tr["p"], t)
        s = sample(tr["s"], t)
        r = sample(tr["r"], t)
        o = sample(tr["o"], t)
        data = affine_data(a, p, s, r)
        warped = local.transform((W * SS, H * SS), Image.AFFINE, data,
                                 resample=Image.BILINEAR)
        if o < 100:
            rr, gg, bb, aa = warped.split()
            aa = aa.point(lambda v: int(v * o / 100.0))
            warped = Image.merge("RGBA", (rr, gg, bb, aa))
        frame.alpha_composite(warped)
    return frame.resize((GIF_SIZE, GIF_SIZE), Image.LANCZOS)


def render_gif(spec):
    layer_imgs = [render_local(l["shapes"]) for l in spec]
    frames = []
    for t in range(DUR):
        rgba = render_frame(spec, t, layer_imgs)
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[3])
        frames.append(bg.convert("P", palette=Image.ADAPTIVE, colors=128))
    out = os.path.join(OUT_DIR, "list-search.gif")
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=int(1000 / FPS), loop=0, optimize=True, disposal=2)
    print("wrote", out, f"({DUR} frames @ {FPS}fps)")


# ============================================================================
# Lottie (bodymovin) emitter
# ============================================================================
def _ks_prop(prop, dims, is_color=False, percent=False):
    kind = prop[0]
    if kind == "static":
        v = prop[1]
        k = v if isinstance(v, (list, tuple)) else [v]
        return {"a": 0, "k": (list(k) if dims > 1 else k[0] if len(k) == 1 else list(k))}
    # animated
    kfs = prop[1]
    out = []
    for i, (t, v, ease) in enumerate(kfs):
        s = list(v) if isinstance(v, (list, tuple)) else [v]
        node = {"t": t, "s": s}
        if i < len(kfs) - 1:
            h = EASE[ease]
            if h is None:
                node["o"] = {"x": [0.0], "y": [0.0]}
                node["i"] = {"x": [1.0], "y": [1.0]}
            else:
                node["o"] = {"x": [h[0]], "y": [h[1]]}
                node["i"] = {"x": [h[2]], "y": [h[3]]}
        out.append(node)
    return {"a": 1, "k": out}


def shape_to_lottie(p):
    tr = {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]},
          "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0},
          "o": {"a": 0, "k": 100}}
    if p["kind"] == "rrect":
        it = [
            {"ty": "rc", "p": {"a": 0, "k": [p["cx"], p["cy"]]},
             "s": {"a": 0, "k": [p["w"], p["h"]]}, "r": {"a": 0, "k": p["r"]}},
            {"ty": "fl", "c": {"a": 0, "k": hexf(p["fill"])},
             "o": {"a": 0, "k": round(p.get("alpha", 1.0) * 100)}},
        ]
        if p.get("rot"):
            tr["a"] = {"a": 0, "k": [p["cx"], p["cy"]]}
            tr["p"] = {"a": 0, "k": [p["cx"], p["cy"]]}
            tr["r"] = {"a": 0, "k": p["rot"]}
        it.append(tr)
        return {"ty": "gr", "it": it}
    if p["kind"] == "ellipseFill":
        d = p["rad"] * 2
        return {"ty": "gr", "it": [
            {"ty": "el", "p": {"a": 0, "k": [p["cx"], p["cy"]]},
             "s": {"a": 0, "k": [d, d]}},
            {"ty": "fl", "c": {"a": 0, "k": hexf(p["fill"])},
             "o": {"a": 0, "k": round(p.get("alpha", 1.0) * 100)}},
            tr]}
    if p["kind"] == "ring":
        d = p["rad"] * 2
        return {"ty": "gr", "it": [
            {"ty": "el", "p": {"a": 0, "k": [p["cx"], p["cy"]]},
             "s": {"a": 0, "k": [d, d]}},
            {"ty": "st", "c": {"a": 0, "k": hexf(p["stroke"])},
             "o": {"a": 0, "k": round(p.get("alpha", 1.0) * 100)},
             "w": {"a": 0, "k": p["w"]}, "lc": 2, "lj": 2},
            tr]}
    raise ValueError(p["kind"])


def build_lottie(spec):
    layers = []
    for ind, layer in enumerate(spec):
        tr = layer["tr"]
        ks = {
            "o": _ks_prop(tr["o"], 1),
            "r": _ks_prop(tr["r"], 1),
            "p": _ks_prop(tr["p"], 2),
            "a": _ks_prop(tr["a"], 2),
            "s": _ks_prop(tr["s"], 2),
        }
        layers.append({
            "ddd": 0, "ind": ind + 1, "ty": 4, "nm": layer["nm"], "sr": 1,
            "ks": ks, "ao": 0,
            "shapes": [shape_to_lottie(p) for p in layer["shapes"]],
            "ip": 0, "op": DUR, "st": 0, "bm": 0,
        })
    # Lottie draws layers[0] on top -> reverse so card ends up behind.
    layers = list(reversed(layers))
    for i, l in enumerate(layers):
        l["ind"] = i + 1
    doc = {
        "v": "5.7.4", "fr": FPS, "ip": 0, "op": DUR, "w": W, "h": H,
        "nm": "List Search", "ddd": 0, "assets": [], "layers": layers,
    }
    out = os.path.join(OUT_DIR, "list-search.json")
    with open(out, "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    print("wrote", out, f"({len(layers)} layers)")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    spec = build_spec()
    build_lottie(spec)
    render_gif(spec)


if __name__ == "__main__":
    main()
