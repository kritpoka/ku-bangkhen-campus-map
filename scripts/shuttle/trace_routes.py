"""
Trace KU shuttle (รถตะลัย) routes from KU's official route maps onto OSM roads.

One-off data tool (Python 3 + Pillow + numpy + scipy). It is NOT needed to run
or build the site; its output is committed in src/data/shuttle-paths.json.

Source images (Office of Physical Plant and Sustainable Environment, KU,
"แผนผังเส้นทางให้บริการรถโดยสารสวัสดิการ", dated 01032565 = 1 Mar 2022,
still linked from https://vehicle.ku.ac.th/index.html/ alongside the 2026
service schedule):
  https://vehicle.ku.ac.th/index.html/wp-content/uploads/2022/06/bus1.jpeg  (line 1)
  https://vehicle.ku.ac.th/index.html/wp-content/uploads/2022/06/bus3.jpeg  (line 3)
  https://vehicle.ku.ac.th/index.html/wp-content/uploads/2022/06/bus5.jpeg  (line 5)

Method
1. Georeference each map: an affine transform from pixels to local meters,
   initialised from the four gate markers + the Hexagonal Pavilion stop and
   refined by ICP (navy route pixels -> nearest OSM road).
2. A road segment belongs to a line when the route ink covers most of it.
3. Stop dots are detected as round black blobs, georeferenced, and matched to
   the stop codes read from the map (STOP_CODES) and to OSM bus stops.

Usage:
  mkdir -p .cache/shuttle && cd .cache/shuttle
  curl -O <each image URL above>  (plus .../2022/06/bus_way.jpeg, the overview)
  python3 scripts/shuttle/trace_routes.py .cache/shuttle src/data/shuttle-paths.json [--debug out.png] [--chains]

Review the --debug render against the official maps before committing; fix
anything wrong with the EXCLUDE list below.
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
OSM = ROOT / 'src' / 'data' / 'osm'
meta = json.loads((OSM / 'meta.json').read_text())
LAT0, LNG0 = meta['origin']['lat'], meta['origin']['lng']
K = math.pi / 180 * 6378137
C = math.cos(math.radians(LAT0))

def proj(lng, lat):
    return ((lng - LNG0) * K * C, (lat - LAT0) * K)

def unproj(x, y):
    return (x / (K * C) + LNG0, y / K + LAT0)

# Gate entrances and the Hexagonal Pavilion stop (OSM) as initial control points.
CONTROL_WORLD = {
    'vibhavadi': proj(100.5646542, 13.8523812),
    'ngw3': proj(100.5660005, 13.8452282),
    'ngw2': proj(100.5681072, 13.8440502),
    'ngw1': proj(100.5713906, 13.8422117),
    'pavilion': proj(100.576081, 13.842127),
}
# Approximate pixel positions (original image pixels) of the same points,
# read off each map; refined to the nearest marker centroid automatically.
CONTROL_PX = {
    'bus1': {'vibhavadi': (319, 374), 'ngw3': (365, 1102), 'ngw2': (560, 1242), 'ngw1': (858, 1461), 'pavilion': (1321, 1520)},
    'bus3': {'vibhavadi': (369, 377), 'ngw3': (420, 1105), 'ngw2': (615, 1248), 'ngw1': (913, 1467), 'pavilion': (1379, 1528)},
    'bus5': {'vibhavadi': (310, 380), 'ngw3': (357, 1120), 'ngw2': (558, 1262), 'ngw1': (858, 1485), 'pavilion': (1336, 1550)},
}
NAVY = np.array([40, 45, 120])

def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)

def route_mask(a):
    """Navy route ink: only large connected strokes (drops titles, arrows, labels)."""
    m = np.abs(a - NAVY).sum(-1) < 110
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.nonzero(sizes > 1500)[0])
    return keep

def red_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 190) & (g < 110) & (b < 110)

def refine_marker(red, p, r=40):
    x, y = p
    sub = red[y - r:y + r, x - r:x + r]
    lab, n = ndimage.label(sub)
    if n == 0:
        return p
    sizes = ndimage.sum(sub, lab, range(1, n + 1))
    i = int(np.argmax(sizes)) + 1
    cy, cx = ndimage.center_of_mass(sub, lab, i)
    return (x - r + cx, y - r + cy)

def basis(px, order):
    px = np.asarray(px, float) / 1000.0  # keep the quadratic terms well-conditioned
    x, y = px[:, 0], px[:, 1]
    cols = [x, y, np.ones_like(x)]
    if order >= 2:
        cols += [x * x, x * y, y * y]
    return np.stack(cols, 1)

def fit_affine(px, world, order=1):
    sol, *_ = np.linalg.lstsq(basis(px, order), np.asarray(world, float), rcond=None)
    return (order, sol)

def apply(T, px):
    order, sol = T
    return basis(px, order) @ sol

def road_samples(step=1.0):
    roads = json.loads((OSM / 'roads.json').read_text())['features']
    segs, pts = [], []
    for f in roads:
        if f['properties']['class'] == 'path':
            continue
        g = f['geometry']
        lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
        for coords in lines:
            add_line(segs, pts, [proj(*c) for c in coords], f['properties']['id'], step)
    return segs, np.array(pts)

def add_line(segs, pts, line, way, step):
        for a, b in zip(line, line[1:]):
            L = math.dist(a, b)
            if L < 0.01:
                continue
            si = len(segs)
            segs.append({'a': a, 'b': b, 'way': way})
            n = max(1, int(L / step))
            for t in np.linspace(0, 1, n + 1):
                pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, si))

def icp(T, ink_px, tree, road_xy, iters=40):
    for it in range(iters):
        W = apply(T, ink_px)
        d, idx = tree.query(W)
        thr = max(4.0, np.percentile(d, 80))
        keep = d < thr
        # Affine first, then allow a gentle quadratic warp for the illustration's distortion.
        T = fit_affine(ink_px[keep], road_xy[idx[keep]], 1 if it < 15 else 2)
    W = apply(T, ink_px)
    d, _ = tree.query(W)
    return T, d

def georeference(name, a):
    ink = route_mask(a)
    ys, xs = np.nonzero(ink)
    rng = np.random.default_rng(1)
    sel = rng.choice(len(xs), size=min(6000, len(xs)), replace=False)
    ink_px = np.stack([xs[sel], ys[sel]], 1).astype(float)
    red = red_mask(a)
    px = [refine_marker(red, CONTROL_PX[name][k]) for k in CONTROL_WORLD]
    T0 = fit_affine(px, list(CONTROL_WORLD.values()))
    return T0, ink, ink_px

def nonrigid(W, tree, road_xy, iters=4, sigma=60.0, max_res=25.0):
    """Smooth local correction: move each ink point by the Gaussian-weighted
    mean residual (ink -> nearest road) of its neighbourhood. Absorbs the
    illustration's local distortion without letting points snap independently."""
    W = W.copy()
    for _ in range(iters):
        d, idx = tree.query(W)
        R = road_xy[idx] - W
        R[d > max_res] = 0.0
        valid = d <= max_res
        itree = cKDTree(W)
        field = np.zeros_like(W)
        # Evaluate the field on a subsample and interpolate to all points.
        sub = np.arange(0, len(W), 7)
        for j in sub:
            nb = itree.query_ball_point(W[j], 2.5 * sigma)
            nb = [k for k in nb if valid[k]]
            if not nb:
                continue
            w = np.exp(-np.sum((W[nb] - W[j]) ** 2, 1) / (2 * sigma ** 2))
            field[j] = (R[nb] * w[:, None]).sum(0) / w.sum()
        stree = cKDTree(W[sub])
        _, near = stree.query(W)
        W = W + field[sub][near]
    return W

# Manual corrections after visual review against the official maps (see the
# debug render written next to the output). Each entry: OSM way id -> reason.
EXCLUDE = {
    'bus1': {
        'way/176059323': 'small loop beside the library road picked up by tolerance',
    },
    'bus5': {
        'way/707597769': 'parking aisle west of the trunk; official western stroke has no OSM road',
        'way/866917279': 'driveway stub west of the trunk',
        'way/866917280': 'service stub west of the trunk',
        'way/176059323': 'small loop west of the trunk',
        'way/176059332': 'small loop west of the trunk',
        'way/693628966': 'stub north-west of the trunk',
        'way/707593960': 'stub north-west of the trunk',
        'way/94054900': 'roundabout detour west of E10; official line stays on the trunk',
        'way/94054891': 'roundabout detour west of E10',
        'way/259496891': 'diagonal to the roundabout west of E10',
        'way/93917368': 'line 1 road (ถนนจักรพันธ์) reached only via the excluded stubs',
        'way/589732942': 'driveway loop off the dormitory road',
        'way/589732943': 'driveway loop off the dormitory road',
        'way/383695643': 'hook near Vet Tech that does not match the official E8-E9 branch',
        'way/383695656': 'hook near Vet Tech that does not match the official E8-E9 branch',
    },
}

COVER_TOL = 14.0  # m: route ink this close counts as covering the road (parallel lines are drawn ~9 m apart)
COVER_MIN = 0.6  # fraction of a segment that must be covered

def members(segs, ink_world):
    """Indices of road segments the route ink covers."""
    tree = cKDTree(ink_world)
    out = []
    for i, sg in enumerate(segs):
        (ax, ay), (bx, by) = sg['a'], sg['b']
        L = math.hypot(bx - ax, by - ay)
        n = max(2, int(L / 2.5))
        t = np.linspace(0, 1, n)
        P = np.stack([ax + (bx - ax) * t, ay + (by - ay) * t], 1)
        d, _ = tree.query(P)
        if (d < COVER_TOL).mean() >= COVER_MIN:
            out.append(i)
    return out

GAP_MAX = 160.0  # m: bridge loose ends this far apart along the road network
SPUR_MAX = 80.0  # m: dead-end branches shorter than this are tolerance artefacts (routes are loops; real termini are long)

def key(p):
    return (round(p[0], 2), round(p[1], 2))

def road_graph(segs):
    g = {}
    for i, sg in enumerate(segs):
        a, b = key(sg['a']), key(sg['b'])
        L = math.dist(sg['a'], sg['b'])
        g.setdefault(a, []).append((b, i, L))
        g.setdefault(b, []).append((a, i, L))
    return g

def degree(idx_set, segs):
    deg = {}
    for i in idx_set:
        for e in ('a', 'b'):
            k = key(segs[i][e])
            deg[k] = deg.get(k, 0) + 1
    return deg

def fill_gaps(segs, idx, graph):
    """Connect dangling ends of the traced network via shortest road paths."""
    import heapq
    member = set(idx)
    for _ in range(3):
        deg = degree(member, segs)
        ends = [k for k, d in deg.items() if d == 1]
        nodes = set(deg)
        added = False
        for start in ends:
            dist, prev = {start: 0.0}, {}
            pq = [(0.0, start)]
            hit = None
            while pq:
                d, u = heapq.heappop(pq)
                if d > GAP_MAX:
                    break
                if u != start and u in nodes and d > 0:
                    hit = u
                    break
                for v, si, L in graph.get(u, []):
                    if si in member and u == start:
                        continue  # don't walk back along the line itself
                    nd = d + L
                    if nd < dist.get(v, 1e18):
                        dist[v], prev[v] = nd, (u, si)
                        heapq.heappush(pq, (nd, v))
            if hit:
                u = hit
                while u != start:
                    pu, si = prev[u]
                    if si not in member:
                        member.add(si)
                        added = True
                    u = pu
        if not added:
            break
    return sorted(member)

def prune_spurs(segs, idx):
    """Iteratively remove dead-end branches shorter than SPUR_MAX."""
    member = set(idx)
    while True:
        deg = degree(member, segs)
        adj = {}
        for i in member:
            for e in ('a', 'b'):
                adj.setdefault(key(segs[i][e]), []).append(i)
        removed = False
        for k, d in deg.items():
            if d != 1:
                continue
            # Walk from the dead end to the first junction.
            path, cur, length = [], k, 0.0
            seg = adj[cur][0]
            while True:
                path.append(seg)
                a, b = key(segs[seg]['a']), key(segs[seg]['b'])
                length += math.dist(segs[seg]['a'], segs[seg]['b'])
                cur = b if a == cur else a
                nxt = [j for j in adj[cur] if j not in path]
                if deg.get(cur, 0) != 2 or not nxt:
                    break
                seg = nxt[0]
            if length < SPUR_MAX and deg.get(cur, 0) >= 3:
                member -= set(path)
                removed = True
                break
        if not removed:
            return sorted(member)

STRICT_TOL = 6.0  # m
STRICT_MIN = 0.45

def strict_cover(segs, chain_segs, ink_tree):
    pts = []
    for i in chain_segs:
        (ax, ay), (bx, by) = segs[i]['a'], segs[i]['b']
        n = max(2, int(math.hypot(bx - ax, by - ay) / 2.0))
        t = np.linspace(0, 1, n)
        pts.append(np.stack([ax + (bx - ax) * t, ay + (by - ay) * t], 1))
    d, _ = ink_tree.query(np.vstack(pts))
    return (d < STRICT_TOL).mean()

def junction_chains(segs, member):
    """Split the member network into chains between junctions / dead ends."""
    deg = degree(member, segs)
    adj = {}
    for i in member:
        for e in ('a', 'b'):
            adj.setdefault(key(segs[i][e]), []).append(i)
    seen, out = set(), []
    for i in member:
        if i in seen:
            continue
        # Extend both ways from segment i through degree-2 nodes.
        chain = [i]
        seen.add(i)
        ends = []
        for e in ('a', 'b'):
            cur, seg = key(segs[i][e]), i
            while deg.get(cur, 0) == 2:
                nxt = [j for j in adj[cur] if j != seg]
                if not nxt or nxt[0] in seen:
                    break
                seg = nxt[0]
                seen.add(seg)
                chain.append(seg)
                a, b = key(segs[seg]['a']), key(segs[seg]['b'])
                cur = b if a == cur else a
            ends.append(cur)
        out.append((chain, ends[0], ends[1]))
    return out

def connected_without(member, segs, removed, u, v):
    g = {}
    for i in member - removed:
        a, b = key(segs[i]['a']), key(segs[i]['b'])
        g.setdefault(a, []).append(b)
        g.setdefault(b, []).append(a)
    stack, seen = [u], {u}
    while stack:
        x = stack.pop()
        if x == v:
            return True
        for y in g.get(x, []):
            if y not in seen:
                seen.add(y)
                stack.append(y)
    return False

def drop_side_loops(segs, idx, ink_tree):
    """Remove poorly covered chains whose removal keeps the network connected
    (driveway loops and building ring roads next to the route)."""
    member = set(idx)
    while True:
        worst = None
        for chain, u, v in junction_chains(segs, member):
            c = strict_cover(segs, chain, ink_tree)
            length = sum(math.dist(segs[i]['a'], segs[i]['b']) for i in chain)
            # Short rungs (parking-bay connectors) count as poorly covered.
            if length < 30.0:
                c = min(c, STRICT_MIN - 0.01)
            if c < STRICT_MIN and (worst is None or c < worst[0]):
                if u == v or connected_without(member, segs, set(chain), u, v):
                    worst = (c, chain)
        if not worst:
            return sorted(member)
        member -= set(worst[1])

def chains(segs, idx):
    """Merge member segments into polylines through shared endpoints."""
    key = lambda p: (round(p[0], 2), round(p[1], 2))
    adj = {}
    for i in idx:
        for end in ('a', 'b'):
            adj.setdefault(key(segs[i][end]), []).append(i)
    used, out = set(), []
    def walk(start_seg, start_pt):
        line, seg, pt = [start_pt], start_seg, start_pt
        while True:
            used.add(seg)
            a, b = segs[seg]['a'], segs[seg]['b']
            nxt = b if key(a) == key(pt) else a
            line.append(nxt)
            cand = [j for j in adj[key(nxt)] if j not in used]
            if len(adj[key(nxt)]) != 2 or not cand:
                return line
            seg, pt = cand[0], nxt
    # Start from endpoints / junctions first, then any leftover loops.
    for i in idx:
        if i in used:
            continue
        for end in ('a', 'b'):
            if len(adj[key(segs[i][end])]) != 2 and i not in used:
                out.append(walk(i, segs[i][end]))
    for i in idx:
        if i not in used:
            out.append(walk(i, segs[i]['a']))
    return out

# Stop codes and their dot positions on the overview map (bus_way.jpeg),
# in original-image pixels, read off the map. E1 appears twice on the map
# (Hexagonal Pavilion by the BTS, and the Amornphan sub-gate by the
# auditorium); they are E1a and E1b here.
STOP_CODES_PX = {code: (round(x * 1.2175), round(y * 1.2175)) for code, (x, y) in {
    'E1a': (1140, 1250), 'E1b': (1015, 1375), 'E2': (990, 1222), 'E3': (955, 1180), 'E4': (860, 1160),
    'E5': (845, 1140), 'E6': (905, 1025), 'E7': (982, 935), 'E8': (1185, 992), 'E9': (1185, 1045),
    'E10': (918, 877), 'E11': (937, 808), 'E12': (893, 795), 'E13': (940, 700), 'E14': (918, 605),
    'E15': (958, 575), 'E16': (923, 555), 'E17': (935, 458), 'E18': (965, 458), 'E19': (1275, 475),
    'E20': (1405, 428), 'E21': (1460, 385), 'E22': (1520, 412), 'E23': (1540, 433), 'E24': (1565, 475),
    'E25': (1565, 527),
    'C1': (713, 1060), 'C2': (755, 900), 'C6': (870, 583), 'C7': (655, 563), 'C8': (510, 548),
    'C9': (495, 727), 'C10': (580, 773), 'C11': (690, 817), 'C12': (752, 848),
    'N1': (540, 318), 'N2': (593, 201), 'N3': (745, 197), 'N9': (813, 385), 'N11': (948, 400),
    'S1': (733, 1133), 'S2': (565, 1020), 'S3': (425, 912), 'S7': (777, 1135),
    'W1': (418, 437), 'W2': (300, 604), 'W3': (342, 643), 'W4': (318, 750), 'W6': (388, 627),
    'W7': (396, 476), 'W8': (435, 345),
}.items()}
OVERVIEW_CONTROL_PX = {'vibhavadi': (444, 434), 'ngw3': (487, 1118), 'ngw2': (670, 1248), 'ngw1': (950, 1455), 'pavilion': (1388, 1522)}

def locate_stops(path, tree, road_xy):
    """Georeference the overview map (red + teal route ink) and convert stop codes to meters."""
    a = load(path)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 190) & (g < 90) & (b < 90)
    teal = (r < 40) & (g > 80) & (g < 140) & (b > 60) & (b < 120)
    ink = red | teal
    lab, n = ndimage.label(ink, structure=np.ones((3, 3)))
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    ink = np.isin(lab, 1 + np.nonzero(sizes > 1500)[0])
    ys, xs = np.nonzero(ink)
    rng = np.random.default_rng(2)
    sel = rng.choice(len(xs), size=min(6000, len(xs)), replace=False)
    ink_px = np.stack([xs[sel], ys[sel]], 1).astype(float)
    gate = red_mask(a)
    px = [refine_marker(gate, OVERVIEW_CONTROL_PX[k]) for k in CONTROL_WORLD]
    T0 = fit_affine(px, list(CONTROL_WORLD.values()))
    T, d = icp(T0, ink_px, tree, road_xy)
    print(f'overview: ICP median {np.median(d):.1f} m, p90 {np.percentile(d, 90):.1f} m')
    codes = list(STOP_CODES_PX)
    world = apply(T, [STOP_CODES_PX[c] for c in codes])
    return {c: (float(x), float(y)) for c, (x, y) in zip(codes, world)}

def write_output(out, results, stops):
    lines = {}
    for name, r in results.items():
        lines[name.replace('bus', '')] = [
            [[round(v, 6) for v in unproj(*p)] for p in line] for line in r['lines']
        ]
    data = {
        'note': 'Generated by scripts/shuttle/trace_routes.py from KU official route maps (dated 1 Mar 2022). Do not edit by hand.',
        'lines': lines,
        'stopCodes': {c: [round(v, 6) for v in unproj(*p)] for c, p in stops.items()},
    }
    out.write_text(json.dumps(data, ensure_ascii=False) + '\n')
    print('wrote', out)

def debug_render(segs, results, out, stops=None):
    """Overlay traced lines (and raw georeferenced ink) on OSM roads, for review."""
    from PIL import ImageDraw
    W, H, s = 1400, 1400, 0.62  # px per m
    cx, cy = 50, 100
    img = Image.new('RGB', (W, H), 'white')
    dr = ImageDraw.Draw(img)
    tp = lambda p: (W / 2 + (p[0] - cx) * s, H / 2 - (p[1] - cy) * s)
    for sg in segs:
        dr.line([tp(sg['a']), tp(sg['b'])], fill=(205, 205, 205), width=2)
    colors = {'bus1': (220, 40, 40), 'bus3': (0, 120, 100), 'bus5': (30, 30, 30)}
    offs = {'bus1': (-3, 0), 'bus3': (0, 0), 'bus5': (3, 0)}
    for name, r in results.items():
        for p in r['ink_world'][::40]:
            x, y = tp(p)
            dr.point((x, y), fill=tuple(int(c * 0.4 + 255 * 0.6) for c in colors[name]))
    for name, r in results.items():
        ox, oy = offs[name]
        for l in r['lines']:
            dr.line([(tp(p)[0] + ox, tp(p)[1] + oy) for p in l], fill=colors[name], width=4)
    for code, p in (stops or {}).items():
        x, y = tp(p)
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(30, 60, 200))
        dr.text((x + 5, y - 6), code, fill=(30, 60, 200))
    img.save(out)


if __name__ == '__main__':
    src = Path(sys.argv[1])
    segs, pts = road_samples()
    tree = cKDTree(pts[:, :2])
    results = {}
    graph = road_graph(segs)
    for name in ['bus1', 'bus3', 'bus5']:
        a = load(src / f'{name}.jpeg')
        T0, ink, ink_px = georeference(name, a)
        d0, _ = tree.query(apply(T0, ink_px))
        T, d = icp(T0, ink_px, tree, pts[:, :2])
        print(f'{name}: ink px {ink.sum()}, init median {np.median(d0):.1f} m -> ICP median {np.median(d):.1f} m, p90 {np.percentile(d, 90):.1f} m')
        ys, xs = np.nonzero(ink)
        ink_world = nonrigid(apply(T, np.stack([xs, ys], 1)), tree, pts[:, :2])
        dn, _ = tree.query(ink_world)
        print(f'   after non-rigid: median {np.median(dn):.1f} m, p90 {np.percentile(dn, 90):.1f} m')
        idx = members(segs, ink_world)
        idx = prune_spurs(segs, fill_gaps(segs, idx, graph))
        idx = prune_spurs(segs, drop_side_loops(segs, idx, cKDTree(ink_world)))
        excluded = EXCLUDE.get(name, {})
        idx = [i for i in idx if segs[i]['way'] not in excluded]
        graph_ok = {k: [e for e in v if segs[e[1]]['way'] not in excluded] for k, v in graph.items()}
        idx = prune_spurs(segs, fill_gaps(segs, idx, graph_ok))
        if '--chains' in sys.argv:
            tp = lambda q: (700 + (q[0] - 50) * 0.62, 700 - (q[1] - 100) * 0.62)
            for chain, u, v in junction_chains(segs, set(idx)):
                L = sum(math.dist(segs[i]['a'], segs[i]['b']) for i in chain)
                if L < 140:
                    ways = sorted({segs[i]['way'] for i in chain})
                    m = tp(segs[chain[len(chain) // 2]]['a'])
                    print(f'     chain {L:5.0f} m at render ({m[0]:.0f},{m[1]:.0f}) ways {ways}')
        lines = chains(segs, idx)
        total = sum(math.dist(p, q) for l in lines for p, q in zip(l, l[1:]))
        print(f'   {len(idx)} road segments, {len(lines)} polylines, {total/1000:.2f} km')
        results[name] = {'T': T, 'lines': lines, 'ink_world': ink_world, 'image': a}
    stops = locate_stops(src / 'bus_way.jpeg', tree, pts[:, :2])
    write_output(Path(sys.argv[2]), results, stops)
    if '--debug' in sys.argv:
        debug_render(segs, results, Path(sys.argv[sys.argv.index('--debug') + 1]), stops)

