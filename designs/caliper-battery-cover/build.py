#!/usr/bin/env python3
"""Build STL files and preview images for the caliper battery cover.

This mirrors caliper_battery_cover.scad so the STLs can be produced without
OpenSCAD installed. The .scad file is the one to edit; if you have OpenSCAD,
`openscad -o cover.stl caliper_battery_cover.scad` is the simpler route.

Usage:  python3 build.py [--channel-w 15.0] [--opening-w 12.6] [--cover-l 18]
                         [--plate-t 1.5] [--tongue-t 0.8] [--clearance 0.15]
Outputs: cover.stl, fit_test.stl, preview_cover.png, cross_section.png
"""
import argparse
import os

import numpy as np
import trimesh
from trimesh.creation import box, cylinder

HERE = os.path.dirname(os.path.abspath(__file__))


def union(parts):
    return trimesh.boolean.union(parts, engine="manifold")


def difference(a, b):
    return trimesh.boolean.difference([a, b], engine="manifold")


def abox(x0, y0, z0, dx, dy, dz):
    """Axis aligned box with its min corner at (x0, y0, z0)."""
    b = box(extents=[dx, dy, dz])
    b.apply_translation([x0 + dx / 2, y0 + dy / 2, z0 + dz / 2])
    return b


def cover_body(p, w=None, length=None):
    w = p.channel_w if w is None else w
    length = p.cover_l if length is None else length
    ww = w - p.clearance
    vw = p.opening_w - p.clearance
    tt = p.tongue_t - p.clearance
    plate = abox(0, -vw / 2, 0, length, vw, p.plate_t)
    tongue = abox(0, -ww / 2, 0, length, ww, tt)
    body = union([plate, tongue])
    # 45 degree chamfer on the leading edge of the tongues (x = 0, z = 0):
    # a square of side c*sqrt(2) rotated 45 degrees about Y and centred on the
    # edge covers exactly the region |x| + |z| <= c.
    c = p.lead_chamfer
    prism = box(extents=[c * np.sqrt(2), ww + 2, c * np.sqrt(2)])
    prism.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 4, [0, 1, 0]))
    return difference(body, prism)


def grip(p):
    vw = p.opening_w - p.clearance
    ribs = []
    for i in range(p.grip_ribs):
        x = p.cover_l - p.rib_inset - i * p.rib_pitch - p.rib_w
        ribs.append(abox(x, -vw / 2 + 0.6, p.plate_t - 0.01, p.rib_w, vw - 1.2, p.rib_h + 0.01))
    return ribs


def battery_pad(p):
    if p.battery_pad_h <= 0:
        return []
    c = cylinder(radius=p.battery_pad_d / 2, height=p.battery_pad_h + 0.01, sections=64)
    c.apply_translation([p.battery_x, 0, -p.battery_pad_h + (p.battery_pad_h + 0.01) / 2])
    return [c]


def detent(p):
    if p.detent_d <= 0:
        return []
    cx = p.cover_l - p.detent_x
    sph = trimesh.creation.icosphere(subdivisions=3, radius=p.detent_d / 2)
    sph.apply_translation([cx, 0, p.detent_d / 2 - p.detent_h])
    keep = abox(cx - p.detent_d, -p.detent_d, -p.detent_h,
                2 * p.detent_d, 2 * p.detent_d, p.detent_h + p.tongue_t - p.clearance)
    return [trimesh.boolean.intersection([sph, keep], engine="manifold")]


def end_lip(p):
    if p.end_lip_h <= 0:
        return []
    vw = p.opening_w - p.clearance
    return [abox(p.cover_l - p.end_lip_t, -vw / 2, -p.end_lip_h, p.end_lip_t, vw, p.end_lip_h + 0.01)]


def cover(p):
    parts = [cover_body(p)] + grip(p) + battery_pad(p) + detent(p) + end_lip(p)
    return union(parts)


def fit_test(p):
    length = 6.0
    coupons = []
    for i in range(3):
        w = p.channel_w + (i - 1) * 0.5
        body = cover_body(p, w=w, length=length)
        for n in range(i + 1):
            notch = abox(length - 1.5 - n * 1.5, -p.opening_w / 2 - 1, p.plate_t - 0.3,
                         0.6, p.opening_w + 2, 1)
            body = difference(body, notch)
        body.apply_translation([0, i * (p.channel_w + 4), 0])
        coupons.append(body)
    return union(coupons)


def render_preview(mesh, path, title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(10, 4.5), dpi=130)
    views = [("top (outside face)", 55, -60), ("underside (tongues + chamfer)", -40, -120)]
    for k, (name, elev, azim) in enumerate(views):
        ax = fig.add_subplot(1, 2, k + 1, projection="3d")
        tri = mesh.vertices[mesh.faces]
        coll = Poly3DCollection(tri, facecolor="#9bb7d4", edgecolor="#2b3a4a", linewidths=0.15)
        ax.add_collection3d(coll)
        lo, hi = mesh.bounds
        span = (hi - lo).max()
        mid = (hi + lo) / 2
        ax.set_xlim(mid[0] - span / 2, mid[0] + span / 2)
        ax.set_ylim(mid[1] - span / 2, mid[1] + span / 2)
        ax.set_zlim(mid[2] - span / 2, mid[2] + span / 2)
        ax.view_init(elev=elev, azim=azim)
        ax.set_title(name, fontsize=10)
        ax.set_axis_off()
    fig.suptitle(title, fontsize=11)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def render_cross_section(p, path):
    """Annotated end-on view of the channel and the cover, for taking measurements."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon, Rectangle

    fig, ax = plt.subplots(figsize=(9, 4.2), dpi=130)
    cw, ow, pt, tt = p.channel_w, p.opening_w, p.plate_t, p.tongue_t
    lip = (cw - ow) / 2
    body_h = 4.0
    # housing: a slab with a channel cut in it, drawn as polygon
    hx = cw / 2 + 4
    housing = [(-hx, -body_h), (hx, -body_h), (hx, 0), (ow / 2, 0), (ow / 2, -(pt - tt)),
               (cw / 2, -(pt - tt)), (cw / 2, -pt), (-cw / 2, -pt), (-cw / 2, -(pt - tt)),
               (-ow / 2, -(pt - tt)), (-ow / 2, 0), (-hx, 0)]
    ax.add_patch(Polygon(housing, closed=True, facecolor="#333", edgecolor="k"))
    # cover
    ax.add_patch(Rectangle((-(ow - p.clearance) / 2, -pt), ow - p.clearance, pt,
                           facecolor="#9bb7d4", edgecolor="#1f3550"))
    ax.add_patch(Rectangle((-(cw - p.clearance) / 2, -pt), cw - p.clearance, tt - p.clearance,
                           facecolor="#9bb7d4", edgecolor="#1f3550"))

    def dim(x0, x1, y, label, above=True):
        ax.annotate("", xy=(x0, y), xytext=(x1, y), arrowprops=dict(arrowstyle="<->", lw=1))
        ax.text((x0 + x1) / 2, y + (0.25 if above else -0.45), label, ha="center", fontsize=9)

    def vdim(x, y0, y1, label, side=1):
        ax.annotate("", xy=(x, y0), xytext=(x, y1), arrowprops=dict(arrowstyle="<->", lw=1))
        ax.text(x + 0.3 * side, (y0 + y1) / 2, label, va="center",
                ha="left" if side > 0 else "right", fontsize=9)

    dim(-cw / 2, cw / 2, 2.2, f"A  channel_w = {cw} (groove bottom to groove bottom)")
    dim(-ow / 2, ow / 2, 0.9, f"B  opening_w = {ow} (between the lips)")
    vdim(hx + 0.8, -pt, -(pt - tt), f"C  tongue_t = {tt} (groove height)")
    ax.plot([cw / 2, hx + 1.2], [-pt, -pt], color="#888", lw=0.6, ls=":")
    ax.plot([cw / 2, hx + 1.2], [-(pt - tt), -(pt - tt)], color="#888", lw=0.6, ls=":")
    vdim(-hx - 0.8, 0, -pt, f"E  plate_t = {pt} (surface to groove bottom)", side=-1)
    ax.plot([-cw / 2, -hx - 1.2], [-pt, -pt], color="#888", lw=0.6, ls=":")
    ax.text(0, -body_h - 0.9, f"D  cover_l = {p.cover_l} is measured along the slide direction, "
            "closed end of channel to the housing edge", ha="center", fontsize=9)
    ax.text(0, -pt / 2 - 0.1, "cover", ha="center", va="center", fontsize=9, color="#1f3550")
    ax.text(0, -pt - 1.2, "battery pocket below", ha="center", fontsize=8, color="#ccc")
    ax.set_xlim(-hx - 14, hx + 12)
    ax.set_ylim(-body_h - 1.6, 3.2)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("End-on view of the housing channel (dark) with the cover (blue) in it",
                 fontsize=10, pad=14)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel-w", type=float, default=15.0)
    ap.add_argument("--opening-w", type=float, default=12.6)
    ap.add_argument("--cover-l", type=float, default=18.0)
    ap.add_argument("--plate-t", type=float, default=1.5)
    ap.add_argument("--tongue-t", type=float, default=0.8)
    ap.add_argument("--clearance", type=float, default=0.15)
    ap.add_argument("--lead-chamfer", type=float, default=0.4)
    ap.add_argument("--grip-ribs", type=int, default=3)
    ap.add_argument("--rib-w", type=float, default=0.6)
    ap.add_argument("--rib-h", type=float, default=0.35)
    ap.add_argument("--rib-pitch", type=float, default=1.6)
    ap.add_argument("--rib-inset", type=float, default=2.0)
    ap.add_argument("--battery-pad-h", type=float, default=0.0)
    ap.add_argument("--battery-pad-d", type=float, default=8.0)
    ap.add_argument("--battery-x", type=float, default=8.0)
    ap.add_argument("--detent-d", type=float, default=0.0)
    ap.add_argument("--detent-h", type=float, default=0.3)
    ap.add_argument("--detent-x", type=float, default=4.0)
    ap.add_argument("--end-lip-h", type=float, default=0.0)
    ap.add_argument("--end-lip-t", type=float, default=1.0)
    ap.add_argument("--out", default=HERE)
    p = ap.parse_args()

    c = cover(p)
    f = fit_test(p)
    for m, name in ((c, "cover"), (f, "fit_test")):
        assert m.is_watertight, f"{name} mesh is not watertight"
        m.export(os.path.join(p.out, f"{name}.stl"))
        print(f"{name}.stl  bounds {np.round(m.bounds, 2).tolist()}  volume {m.volume:.1f} mm^3")
    render_preview(c, os.path.join(p.out, "preview_cover.png"),
                   f"cover.stl  {p.cover_l} x {p.channel_w} x {p.plate_t} mm")
    render_cross_section(p, os.path.join(p.out, "cross_section.png"))


if __name__ == "__main__":
    main()
