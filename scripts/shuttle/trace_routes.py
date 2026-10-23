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
  https://vehicle.ku.ac.th/index.html/wp-content/uploads/2022/06/bus_way.jpeg (overview, stop codes)

Method
1. Georeference each map: an affine transform from pixels to local meters,
   initialised from the four gate markers + the Hexagonal Pavilion stop and
   refined by ICP (navy route pixels -> nearest OSM road), then a smooth
   non-rigid correction for the illustration's local distortion.
2. Road graph: drivable OSM roads inside the campus area only (the OSM campus
   polygons + AREA_TOL), plus the reviewed KU roads in outside-roads.json that
   OSM's campus polygon leaves out. Public roads (primary/secondary/trunk/…,
   and anything named Ngamwongwan / Phahonyothin / Vibhavadi) are never used.
3. Each road is weighted by how well that line's ink covers it, so off-route
   roads cost several times their length.
4. The route is the cheapest path through the line's stops in order (from
   src/data/shuttle.ts) and back to the first stop: one continuous polyline
   per line, with U-turns penalised.

Usage:
  mkdir -p .cache/shuttle && cd .cache/shuttle
  curl -O <each image URL above>
  python3 scripts/shuttle/trace_routes.py .cache/shuttle src/data/shuttle-paths.json [--debug out-dir]
  npm run test:shuttle-data        # validates the result

Review the --debug renders (route drawn back onto each official map) before
committing.
"""
import heapq, json, math, re, sys
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


# ─── Campus area ────────────────────────────────────────────────────────────

AREA_TOL = 10.0  # m: roads this close to the OSM campus polygons count as inside (edge roads, mapping slop)
PUBLIC_HIGHWAY = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
                  'secondary', 'secondary_link', 'tertiary', 'tertiary_link'}
PUBLIC_NAMES = ('งามวงศ์วาน', 'พหลโยธิน', 'วิภาวดี', 'Ngam Wong Wan', 'Phahon Yothin', 'Vibhavadi')
DISCOVER = '--discover' in sys.argv  # review aid: also allow every non-public road outside the area
OUTSIDE_ROADS = json.loads((Path(__file__).parent / 'outside-roads.json').read_text())['ways']

def campus_edges():
    """Edges (N x 4: ax, ay, bx, by in meters) of every ring of the campus MultiPolygon."""
    g = json.loads((OSM / 'boundary.json').read_text())['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    E = []
    for poly in polys:
        for ring in poly:
            P = [proj(*c) for c in ring]
            E += [(*P[i], *P[i + 1]) for i in range(len(P) - 1)]
    return np.array(E)

EDGES = None

def area_distance(P):
    """Distance (m) from each point to the campus area: 0 inside, else to the nearest edge."""
    global EDGES
    if EDGES is None:
        EDGES = campus_edges()
    P = np.atleast_2d(np.asarray(P, float))
    ax, ay, bx, by = (EDGES[:, i][None, :] for i in range(4))
    px, py = P[:, 0:1], P[:, 1:2]
    dx, dy = bx - ax, by - ay
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / np.maximum(dx * dx + dy * dy, 1e-9), 0, 1)
    d = np.hypot(ax + t * dx - px, ay + t * dy - py).min(1)
    # Even-odd ray cast across all rings (outer rings and holes alike).
    cross = ((ay > py) != (by > py)) & (px < ax + (py - ay) * dx / np.where(dy == 0, 1e-9, dy))
    inside = cross.sum(1) % 2 == 1
    return np.where(inside, 0.0, d)

def is_public(props):
    name = (props.get('name') or '') + ' ' + (props.get('name:en') or '')
    return props.get('highway') in PUBLIC_HIGHWAY or any(n in name for n in PUBLIC_NAMES)

# ─── Road graph ─────────────────────────────────────────────────────────────

def key(p):
    return (round(p[0], 2), round(p[1], 2))

def drivable_segments():
    """Every drivable OSM road segment, with an `allowed` flag (campus area, not public)."""
    roads = json.loads((OSM / 'roads.json').read_text())['features']
    segs = []
    for f in roads:
        pr = f['properties']
        if pr['class'] == 'path':
            continue
        g = f['geometry']
        for coords in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
            P = [proj(*c) for c in coords]
            for a, b in zip(P, P[1:]):
                if math.dist(a, b) > 0.01:
                    segs.append({'a': a, 'b': b, 'way': pr['id'], 'props': pr})
    mids = np.array([[(s['a'][0] + s['b'][0]) / 2, (s['a'][1] + s['b'][1]) / 2] for s in segs])
    da = area_distance([s['a'] for s in segs])
    db = area_distance([s['b'] for s in segs])
    dm = area_distance(mids)
    for s, x, y, z in zip(segs, da, db, dm):
        s['outside'] = max(x, y, z) > AREA_TOL
        s['allowed'] = not is_public(s['props']) and (not s['outside'] or s['way'] in OUTSIDE_ROADS or DISCOVER)
    return segs

def coverage(segs, ink_tree):
    """Per segment: mean ink credit (1 within 6 m of the line's ink, 0 beyond 16 m)."""
    out = np.zeros(len(segs))
    for i, sg in enumerate(segs):
        (ax, ay), (bx, by) = sg['a'], sg['b']
        n = max(2, int(math.hypot(bx - ax, by - ay) / 2.0) + 1)
        t = np.linspace(0, 1, n)
        d, _ = ink_tree.query(np.stack([ax + (bx - ax) * t, ay + (by - ay) * t], 1))
        out[i] = np.clip((16.0 - d) / 10.0, 0, 1).mean()
    return out

OFF_INK = 8.0     # an uncovered road costs (1 + OFF_INK) x its length
UTURN = 250.0     # m-equivalent penalty for turning back on the same road
WRONG_WAY = 4.0   # cost factor for driving against a one-way road
SNAP_MAX = 40.0   # m: a stop must be this close to an allowed road

# Reviewed: stops whose road can't be told from position alone. line -> stop -> OSM way.
STOP_ROADS = {
    '5': {
        # The official line 5 map turns south off the E7 road into a short spur with E8 and E9
        # on its east side; that spur is this road along the west edge of the Vet Tech parcel.
        'e8': 'way/589599723',
        'e9': 'way/589599723',
    },
}

def snap_stops(segs, cov, stops, pinned=None):
    """Candidate attachment points for each stop: the nearest point on each nearby allowed
    road (one per OSM way). A stop between the two carriageways of a divided road gets
    both, and the route uses whichever its direction of travel allows."""
    out = {}
    for sid, p in stops.items():
        best = {}
        for i, sg in enumerate(segs):
            if not sg['allowed'] or (pinned and sid in pinned and sg['way'] != pinned[sid]):
                continue
            (ax, ay), (bx, by) = sg['a'], sg['b']
            dx, dy = bx - ax, by - ay
            t = min(1, max(0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
            q = (ax + t * dx, ay + t * dy)
            d = math.dist(p, q)
            if d > SNAP_MAX:
                continue
            if sg['way'] not in best or d < best[sg['way']]['dist']:
                best[sg['way']] = {'seg': i, 't': t, 'at': q, 'dist': d}
        if not best:
            raise SystemExit(f'stop {sid} is more than {SNAP_MAX} m from any allowed road')
        # Every road within 20 m of the nearest one; the route picks (see build_graph goals).
        top = min(c['dist'] for c in best.values())
        out[sid] = [c for c in sorted(best.values(), key=lambda c: c['dist']) if c['dist'] <= top + 20.0]
    return out

def oneway(props):
    return {'yes': 1, 'true': 1, '1': 1, '-1': -1}.get(str(props.get('oneway')), 0)

def build_graph(segs, cov, snaps):
    """Directed adjacency over allowed segments (one-way roads only forwards); segments
    holding stop candidates are split at them. Returns coords, adjacency, stop goals."""
    splits, goals = {}, {}
    for sid, cands in snaps.items():
        for k, c in enumerate(cands):
            node = ('stop', sid, k)
            splits.setdefault(c['seg'], []).append((c['t'], node, c['at']))
            goals.setdefault(sid, {})[node] = 2.0 * c['dist']  # prefer the nearer carriageway
    coord, adj = {}, {}
    for i, sg in enumerate(segs):
        if not sg['allowed']:
            continue
        ow = oneway(sg['props'])
        pts = [(0.0, key(sg['a']), sg['a'])] + sorted(splits.get(i, [])) + [(1.0, key(sg['b']), sg['b'])]
        for (_, u, pu), (_, v, pv) in zip(pts, pts[1:]):
            coord[u], coord[v] = pu, pv
            L = math.dist(pu, pv)
            c = L * (1 + OFF_INK * (1 - cov[i]))
            # Against a one-way road: allowed but expensive (OSM may map only one carriageway).
            adj.setdefault(u, []).append((v, c if ow >= 0 else c * WRONG_WAY + 60, i))
            adj.setdefault(v, []).append((u, c if ow <= 0 else c * WRONG_WAY + 60, i))
    return coord, adj, goals

def trace_line(order, coord, adj, goals):
    """One continuous loop through the stops in order and back to the first stop.

    A single Dijkstra over (node, previous node, stops visited) states, so the choice of
    carriageway or lay-by at one stop accounts for what it costs to carry on (U-turns
    included). Tried from each candidate of the first stop; the loop closes there."""
    targets = order[1:]
    best_loop = None
    for first, extra in goals[order[0]].items():
        n = len(targets)
        start = (first, None, 0)
        pq = [(extra, start)]
        best = {start: extra}
        back = {}
        end = None
        while pq:
            d, st = heapq.heappop(pq)
            if d > best.get(st, 1e18):
                continue
            u, pu, k = st
            if k == n and u == first and pu is not None:
                end = (d, st)
                break
            if k < n and u in goals[targets[k]]:
                nxt = (u, pu, k + 1)
                nd = d + goals[targets[k]][u]
                if nd < best.get(nxt, 1e18):
                    best[nxt], back[nxt] = nd, st
                    heapq.heappush(pq, (nd, nxt))
            for v, c, _ in adj.get(u, []):
                nd = d + c + (UTURN if v == pu else 0.0)
                nxt = (v, u, k)
                if nd < best.get(nxt, 1e18):
                    best[nxt], back[nxt] = nd, st
                    heapq.heappush(pq, (nd, nxt))
        if end and (best_loop is None or end[0] < best_loop[0]):
            st, nodes = end[1], []
            while st in back:
                if not nodes or nodes[-1] != st[0]:
                    nodes.append(st[0])
                st = back[st]
            nodes.append(st[0])
            best_loop = (end[0], nodes[::-1])
    if best_loop is None:
        raise SystemExit(f'no allowed road loop through stops {order}')
    return best_loop[1], best_loop[0]

# ─── Stop data from src/data/shuttle.ts ─────────────────────────────────────

def read_shuttle_ts():
    """Stop positions and each line's stop order. Off-map stops (outside the campus area,
    e.g. line 5's dormitory section) are not routed: the drawn route covers the campus."""
    s = (ROOT / 'src' / 'data' / 'shuttle.ts').read_text()
    rows = re.findall(r"\{ (?:code: '[\w]+', )?id: '([\w-]+)',[^\n]*?coordinates: \{ lat: ([\d.]+), lng: ([\d.]+) \}([^\n]*)", s)
    stops = {sid: proj(float(lng), float(lat)) for sid, lat, lng, rest in rows if 'offMap: true' not in rest}
    lines = {m.group(1): re.findall(r"'([\w-]+)'", m.group(2))
             for m in re.finditer(r"\n    id: '(\w+)',[\s\S]*?stops: \[([^\]]*)\]", s)}
    lines = {k: [sid for sid in v if sid in stops] for k, v in lines.items()}
    return stops, {k: v for k, v in lines.items() if v}
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


# ─── Output and review renders ──────────────────────────────────────────────

def write_output(out, routes, stop_codes):
    data = {
        'note': 'Generated by scripts/shuttle/trace_routes.py from KU official route maps (dated 1 Mar 2022). '
                'Each line is one continuous loop through its stops in order. Do not edit by hand.',
        'lines': {name.replace('bus', ''): [[round(v, 6) for v in unproj(*p)] for p in pts] for name, pts in routes.items()},
        'stopCodes': {c: [round(v, 6) for v in unproj(*p)] for c, p in stop_codes.items()},
    }
    out.write_text(json.dumps(data, ensure_ascii=False) + '\n')
    print('wrote', out)

def world_to_map(r):
    """Inverse of a line map's georeferencing (world m -> image px), for drawing routes back
    onto the official map: a quadratic fit plus the local residual of nearby ink."""
    W, X = r['ink_world'][::5], r['ink_px'][::5]
    T = fit_affine(W, X, 2)
    res = X - apply(T, W)
    tree = cKDTree(W)
    def f(P):
        P = np.asarray(P, float)
        out = apply(T, P)
        for j, p in enumerate(P):
            nb = tree.query_ball_point(p, 40.0)
            if nb:
                w = np.exp(-np.sum((W[nb] - p) ** 2, 1) / (2 * 15.0 ** 2))
                out[j] += (res[nb] * w[:, None]).sum(0) / max(w.sum(), 1e-9)
        return out
    return f

def debug_on_official(r, pts, stops, out):
    """The traced route (yellow, with a dark casing) and its stops drawn on the official map."""
    from PIL import ImageDraw
    img = Image.fromarray(r['image'].astype(np.uint8))
    dr = ImageDraw.Draw(img)
    f = world_to_map(r)
    px = [tuple(q) for q in f(pts)]
    dr.line(px, fill=(20, 20, 20), width=13, joint='curve')
    dr.line(px, fill=(255, 210, 0), width=7, joint='curve')
    for sid, p in stops.items():
        x, y = f([p])[0]
        dr.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(220, 0, 120), width=4)
    img.resize((img.width // 2, img.height // 2), Image.LANCZOS).save(out, quality=85)
    img.save(out.with_name(out.stem + '-full.jpg'), quality=88)

def debug_osm(segs, routes, stops, out):
    """Top-down OSM render: allowed roads, excluded roads, campus edge, routes and stops."""
    from PIL import ImageDraw
    W, H, s = 1500, 1500, 0.6  # px per m
    cx, cy = 150, 50
    img = Image.new('RGB', (W, H), 'white')
    dr = ImageDraw.Draw(img)
    tp = lambda p: (W / 2 + (p[0] - cx) * s, H / 2 - (p[1] - cy) * s)
    for e in EDGES:
        dr.line([tp(e[:2]), tp(e[2:])], fill=(60, 160, 60), width=2)
    for sg in segs:
        col = (200, 200, 200) if sg['allowed'] else (240, 170, 170)
        dr.line([tp(sg['a']), tp(sg['b'])], fill=col, width=2)
    colors = {'bus1': (220, 40, 40), 'bus3': (0, 120, 100), 'bus5': (30, 30, 30)}
    offs = {'bus1': -4, 'bus3': 0, 'bus5': 4}
    for name, pts in routes.items():
        o = offs[name]
        dr.line([(tp(p)[0] + o, tp(p)[1] + o) for p in pts], fill=colors[name], width=3)
    for sid, p in stops.items():
        x, y = tp(p)
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(30, 60, 200))
        dr.text((x + 5, y - 6), sid.upper(), fill=(30, 60, 200))
    img.save(out)

def uturns(nodes):
    return [i for i in range(1, len(nodes) - 1) if nodes[i - 1] == nodes[i + 1]]


if __name__ == '__main__':
    src = Path(sys.argv[1])
    dbg = Path(sys.argv[sys.argv.index('--debug') + 1]) if '--debug' in sys.argv else None
    segs_all, pts = road_samples()  # every road, as ICP targets
    tree = cKDTree(pts[:, :2])
    segs = drivable_segments()
    print(f'{sum(s["allowed"] for s in segs)} of {len(segs)} drivable segments allowed')
    stops, orders = read_shuttle_ts()
    routes, results = {}, {}
    for name in ['bus1', 'bus3', 'bus5']:
        line = name.replace('bus', '')
        a = load(src / f'{name}.jpeg')
        T0, ink, ink_px = georeference(name, a)
        T, d = icp(T0, ink_px, tree, pts[:, :2])
        ys, xs = np.nonzero(ink)
        all_px = np.stack([xs, ys], 1).astype(float)
        ink_world = nonrigid(apply(T, all_px), tree, pts[:, :2])
        dn, _ = tree.query(ink_world)
        print(f'line {line}: ICP median {np.median(d):.1f} m; after non-rigid median {np.median(dn):.1f} m, p90 {np.percentile(dn, 90):.1f} m')
        cov = coverage(segs, cKDTree(ink_world))
        order = orders[line]
        line_stops = {s: stops[s] for s in order}
        snaps = snap_stops(segs, cov, line_stops, STOP_ROADS.get(line))
        coord, adj, goals = build_graph(segs, cov, snaps)
        try:
            nodes, _ = trace_line(order, coord, adj, goals)
        except SystemExit as e:
            print('  ', e)
            continue
        route = [coord[n] for n in nodes]
        routes[name] = route
        results[name] = {'image': a, 'ink_world': ink_world, 'ink_px': all_px}
        total = sum(math.dist(p, q) for p, q in zip(route, route[1:]))
        print(f'   {len(route)} vertices, {total / 1000:.2f} km')
        for i in uturns(nodes):
            near = min(order, key=lambda sid: math.dist(stops[sid], coord[nodes[i]]))
            print(f'   U-turn at {nodes[i] if nodes[i][0] == "stop" else "node"} ({math.dist(stops[near], coord[nodes[i]]):.0f} m from {near.upper()}), {unproj(*coord[nodes[i]])}')
        used = {n[1]: snaps[n[1]][n[2]] for n in nodes if n[0] == 'stop'}
        for sid in order:
            if sid not in used:
                print(f'   stop {sid.upper()} not reached')
            elif used[sid]['dist'] > 15:
                print(f'   stop {sid.upper()} is {used[sid]["dist"]:.0f} m from the route ({segs[used[sid]["seg"]]["way"]})')
        # Review aid: stretches that are off the official ink or outside OSM's campus polygon.
        seg_of = {}
        for u, v in zip(nodes, nodes[1:]):
            for w, c, i in adj.get(u, []):
                if w == v:
                    seg_of.setdefault(i, 0)
                    seg_of[i] += 1
        off = {}
        for i in seg_of:
            sg = segs[i]
            L = math.dist(sg['a'], sg['b'])
            if cov[i] < 0.3:
                off.setdefault(('off-ink', sg['way']), 0.0)
                off[('off-ink', sg['way'])] += L
            if sg['outside']:
                off.setdefault(('outside', sg['way']), 0.0)
                off[('outside', sg['way'])] += L
        for (kind, way), L in sorted(off.items(), key=lambda x: -x[1]):
            if L >= 15:
                print(f'   {kind:8s} {way:16s} {L:5.0f} m')
        if dbg:
            dbg.mkdir(parents=True, exist_ok=True)
            debug_on_official(results[name], route, line_stops, dbg / f'line{line}-on-official.jpg')
    stop_codes = locate_stops(src / 'bus_way.jpeg', tree, pts[:, :2])
    write_output(Path(sys.argv[2]), routes, stop_codes)
    if dbg:
        debug_osm(segs, routes, {s: stops[s] for o in orders.values() for s in o}, dbg / 'routes-osm.png')
