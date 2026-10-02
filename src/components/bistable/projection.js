/**
 * Corner-pin / mesh projection mapping, done in the page instead of downstream.
 *
 * A projector rarely sits square to the surface it lights, so the image
 * arrives as a trapezoid. Mapping software fixes that by warping a captured
 * texture — but capturing the browser costs a virtual-camera round trip,
 * latency, and a generation of quality. Since we own the page, we apply the
 * same warp directly.
 *
 * The warp is a GRID of control points:
 *
 *   - 1x1 (four corners, the default) is a pure projective homography, which a
 *     CSS `matrix3d` expresses exactly and the GPU applies for free. No extra
 *     machinery, no per-frame cost.
 *   - Click an edge to insert a column/row and the grid subdivides. More than
 *     four points can no longer be one matrix, so rendering switches to the
 *     WebGL mesh path (see warpMesh.js) — every cell keeps its own homography,
 *     so a subdivided grid still reproduces the 1x1 image exactly.
 *
 * `us`/`vs` are the SOURCE coordinates of each column/row (0..1 across the
 * image); `points` are their DESTINATION positions, normalised to the stage
 * box so a saved calibration survives resolution changes. Points are stored
 * row-major: index = row * (us.length) + col.
 */

export const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

const STORE_KEY = 'bistable-projection-grid-v2';

/**
 * How close two columns/rows may sit in source coordinates, and the hard cap
 * per axis. Together these bound the grid at MAX_PER_AXIS^2 control points.
 *
 * The ceiling is set by what stays interactive, not by the maths: the mesh
 * tessellates to a fixed triangle budget, and dragging mutates the DOM
 * directly rather than re-rendering, so the practical limit is the one-time
 * cost of drawing the node overlay when calibration opens. Measured on this
 * machine: ~4,200 SVG nodes ≈ 150ms to lay out, which is a tolerable pause on
 * entering calibrate and invisible afterwards. 64 per axis lands just inside
 * that (65 x 65 = 4,225 points).
 */
const MIN_NODE_GAP = 0.004;
const MAX_PER_AXIS = 64;

export const DEFAULT_GRID = {
  us: [0, 1],
  vs: [0, 1],
  points: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, // top-left, top-right
    { x: 0, y: 1 }, { x: 1, y: 1 }, // bottom-left, bottom-right
  ],
};

const clone = (g) => ({
  us: [...g.us],
  vs: [...g.vs],
  points: g.points.map((p) => ({ ...p })),
});

export const cols = (g) => g.us.length - 1; // cell counts, not point counts
export const rows = (g) => g.vs.length - 1;
export const at = (g, col, row) => g.points[row * g.us.length + col];
export const isBaseQuad = (g) => cols(g) === 1 && rows(g) === 1;

export const isIdentity = (g) => isBaseQuad(g)
  && DEFAULT_GRID.points.every((p, i) => Math.abs(p.x - g.points[i].x) < 1e-6
    && Math.abs(p.y - g.points[i].y) < 1e-6);

/** The four outer corners, clockwise from top-left (for the CSS fast path). */
export function outerCorners(g) {
  const lastCol = g.us.length - 1;
  const lastRow = g.vs.length - 1;
  return [at(g, 0, 0), at(g, lastCol, 0), at(g, lastCol, lastRow), at(g, 0, lastRow)];
}

export function loadGrid() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return clone(DEFAULT_GRID);
    const g = JSON.parse(raw);
    const okShape = Array.isArray(g?.us) && Array.isArray(g?.vs)
      && Array.isArray(g?.points) && g.us.length >= 2 && g.vs.length >= 2
      && g.points.length === g.us.length * g.vs.length
      && g.points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    return okShape ? g : clone(DEFAULT_GRID);
  } catch (e) {
    return clone(DEFAULT_GRID);
  }
}

export function saveGrid(g) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(g)); } catch (e) { /* private mode */ }
}

export const resetGrid = () => clone(DEFAULT_GRID);

/**
 * Homography taking the unit square to four points (Heckbert's square-to-quad).
 * Returns { a..h } for  x' = (a·u + b·v + c) / (g·u + h·v + 1)
 *                       y' = (d·u + e·v + f) / (g·u + h·v + 1)
 */
export function squareToQuad(p) {
  const [p0, p1, p2, p3] = p;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  // Parallelogram — no perspective term, so the projective solve degenerates.
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return {
      a: p1.x - p0.x, b: p2.x - p1.x, c: p0.x,
      d: p1.y - p0.y, e: p2.y - p1.y, f: p0.y,
      g: 0, h: 0,
    };
  }

  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-9) return null; // degenerate quad (collinear corners)
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

/** Evaluate a square-to-quad homography at unit-square (u, v). */
export function applyH(m, u, v) {
  const den = m.g * u + m.h * v + 1;
  return { x: (m.a * u + m.b * v + m.c) / den, y: (m.d * u + m.e * v + m.f) / den };
}

/** The four destination corners of cell (col, row), clockwise from top-left. */
export function cellQuad(g, col, row) {
  return [at(g, col, row), at(g, col + 1, row), at(g, col + 1, row + 1), at(g, col, row + 1)];
}

/** Cell index and local parameter for a source coordinate along a us/vs axis. */
function locate(axis, s) {
  for (let i = 0; i < axis.length - 1; i += 1) {
    if (s >= axis[i] && s <= axis[i + 1]) {
      const span = axis[i + 1] - axis[i];
      return { index: i, t: span > 1e-9 ? (s - axis[i]) / span : 0 };
    }
  }
  const last = axis.length - 2;
  return { index: last, t: 1 };
}

/**
 * Insert a column of control points at source coordinate `u`.
 *
 * New points are placed with the *existing* cell homography, so the projected
 * image does not shift when a node is added — the node lands exactly where the
 * current warp already sends that part of the image.
 */
export function insertColumn(grid, u) {
  if (u <= 1e-4 || u >= 1 - 1e-4) return grid;
  if (cols(grid) >= MAX_PER_AXIS) return grid; // at the interactive ceiling
  if (grid.us.some((x) => Math.abs(x - u) < MIN_NODE_GAP)) return grid; // too close to an existing column
  const { index: ci, t } = locate(grid.us, u);
  const g = clone(grid);
  const rowCount = grid.vs.length;

  const inserted = [];
  for (let row = 0; row < rowCount; row += 1) {
    // Rows on a cell boundary belong to the cell above; the last row to the one above it.
    const cellRow = Math.min(row, rows(grid) - 1);
    const localV = row === rowCount - 1 ? 1 : 0;
    const m = squareToQuad(cellQuad(grid, ci, cellRow));
    inserted.push(m
      ? applyH(m, t, localV)
      : { // degenerate cell: fall back to a straight lerp along the row
        x: at(grid, ci, row).x + (at(grid, ci + 1, row).x - at(grid, ci, row).x) * t,
        y: at(grid, ci, row).y + (at(grid, ci + 1, row).y - at(grid, ci, row).y) * t,
      });
  }

  g.us.splice(ci + 1, 0, u);
  const width = grid.us.length;
  const next = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < width; col += 1) {
      next.push(grid.points[row * width + col]);
      if (col === ci) next.push(inserted[row]);
    }
  }
  g.points = next.map((p) => ({ ...p }));
  return g;
}

/** Insert a row of control points at source coordinate `v`. */
export function insertRow(grid, v) {
  if (v <= 1e-4 || v >= 1 - 1e-4) return grid;
  if (rows(grid) >= MAX_PER_AXIS) return grid; // at the interactive ceiling
  if (grid.vs.some((y) => Math.abs(y - v) < MIN_NODE_GAP)) return grid;
  const { index: ri, t } = locate(grid.vs, v);
  const g = clone(grid);
  const width = grid.us.length;

  const inserted = [];
  for (let col = 0; col < width; col += 1) {
    const cellCol = Math.min(col, cols(grid) - 1);
    const localU = col === width - 1 ? 1 : 0;
    const m = squareToQuad(cellQuad(grid, cellCol, ri));
    inserted.push(m
      ? applyH(m, localU, t)
      : {
        x: at(grid, col, ri).x + (at(grid, col, ri + 1).x - at(grid, col, ri).x) * t,
        y: at(grid, col, ri).y + (at(grid, col, ri + 1).y - at(grid, col, ri).y) * t,
      });
  }

  g.vs.splice(ri + 1, 0, v);
  const head = grid.points.slice(0, (ri + 1) * width);
  const tail = grid.points.slice((ri + 1) * width);
  g.points = [...head, ...inserted, ...tail].map((p) => ({ ...p }));
  return g;
}

/** Drop the column containing `col` (never the outer two). */
export function removeColumn(grid, col) {
  if (col <= 0 || col >= grid.us.length - 1) return grid;
  const width = grid.us.length;
  const g = clone(grid);
  g.us.splice(col, 1);
  g.points = grid.points
    .filter((_, i) => i % width !== col)
    .map((p) => ({ ...p }));
  return g;
}

/** Drop the row containing `row` (never the outer two). */
export function removeRow(grid, row) {
  if (row <= 0 || row >= grid.vs.length - 1) return grid;
  const width = grid.us.length;
  const g = clone(grid);
  g.vs.splice(row, 1);
  g.points = grid.points
    .filter((_, i) => Math.floor(i / width) !== row)
    .map((p) => ({ ...p }));
  return g;
}

/**
 * CSS transform warping an element of `w`×`h` onto the grid's four corners.
 * Only valid for a 1x1 grid; subdivided grids go through warpMesh.js instead.
 * Requires `transform-origin: 0 0` on the element.
 */
export function gridToTransform(grid, w, h) {
  if (!w || !h || !isBaseQuad(grid)) return 'none';
  if (isIdentity(grid)) return 'none'; // skip the GPU layer when unwarped
  const px = outerCorners(grid).map((c) => ({ x: c.x * w, y: c.y * h }));
  const m = squareToQuad(px);
  if (!m) return 'none';
  const { a, b, c, d, e, f, g, h: hh } = m;
  // CSS matrix3d is column-major: m11 m12 m13 m14, m21 …
  const m3d = [
    a, d, 0, g,
    b, e, 0, hh,
    0, 0, 1, 0,
    c, f, 0, 1,
  ].map((n) => (Math.abs(n) < 1e-9 ? 0 : Number(n.toFixed(6)))).join(', ');
  return `matrix3d(${m3d}) scale(${1 / w}, ${1 / h})`;
}

/**
 * Nearest point on the grid's outline to (x, y), for click-to-insert.
 * Returns { axis: 'u'|'v', s } — the source coordinate to subdivide at —
 * or null when the click is not near an edge.
 *
 * @param tol  hit distance in normalised stage units
 */
export function edgeHit(grid, x, y, tol = 0.035) {
  const lastCol = grid.us.length - 1;
  const lastRow = grid.vs.length - 1;
  let best = null;

  const consider = (p, q, sA, sB, axis) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return;
    let t = ((x - p.x) * dx + (y - p.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = p.x + dx * t;
    const cy = p.y + dy * t;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist > tol) return;
    if (!best || dist < best.dist) best = { dist, axis, s: sA + (sB - sA) * t };
  };

  // Top and bottom edges subdivide columns; left and right subdivide rows.
  for (let c = 0; c < lastCol; c += 1) {
    consider(at(grid, c, 0), at(grid, c + 1, 0), grid.us[c], grid.us[c + 1], 'u');
    consider(at(grid, c, lastRow), at(grid, c + 1, lastRow), grid.us[c], grid.us[c + 1], 'u');
  }
  for (let r = 0; r < lastRow; r += 1) {
    consider(at(grid, 0, r), at(grid, 0, r + 1), grid.vs[r], grid.vs[r + 1], 'v');
    consider(at(grid, lastCol, r), at(grid, lastCol, r + 1), grid.vs[r], grid.vs[r + 1], 'v');
  }
  return best;
}
