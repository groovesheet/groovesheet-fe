import { cols, rows, at, cellQuad, squareToQuad, applyH } from './projection';

/**
 * WebGL mesh warp — the renderer for subdivided projection grids.
 *
 * A single CSS `matrix3d` can only express a four-corner homography, so once
 * the user adds nodes the warp has to be drawn as geometry. Each grid cell is
 * tessellated with its OWN homography (not a bilinear patch), which matters:
 * bilinear interpolation of a keystoned quad bends straight lines, while the
 * per-cell homography keeps the mapping projectively correct and makes a
 * subdivided grid reproduce the 1x1 image exactly.
 *
 * TESSELLATION sub-divides each cell further, purely for rendering: triangle
 * rasterisation interpolates affinely, so a quad drawn as two triangles shows
 * the classic "PS1 texture swim".
 *
 * What controls that error is the TOTAL number of subdivisions across the
 * image, not the number per cell — measured against a hard keystone on a
 * 1920px stage, 8 per cell leaves 26px of error on a 1x1 grid but 0.5px on an
 * 8x8 one. So the per-cell count is derived from the grid size to hold the
 * total near TARGET_SPANS: error stays sub-pixel at every grid size, and the
 * triangle count stays flat (~4600) instead of growing with the square of the
 * node count.
 */

const TARGET_SPANS = 48; // subdivisions across the whole image, per axis
const MAX_TESS = 32;

export const tessFor = (nCols, nRows) => Math.max(
  1,
  Math.min(MAX_TESS, Math.ceil(TARGET_SPANS / Math.max(nCols, nRows))),
);

const VERT_SRC = `
attribute vec2 aPos;   // destination, normalised stage coords (0..1, y down)
attribute vec2 aUV;    // source texture coords
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPos.x * 2.0 - 1.0, 1.0 - aPos.y * 2.0, 0.0, 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV;
void main() {
  gl_FragColor = texture2D(uTex, vUV);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`warpMesh shader: ${log}`);
  }
  return sh;
}

/**
 * Triangle soup for a grid: positions in normalised stage coords, uvs in
 * source coords. Rebuilt only when the grid changes, not per frame.
 */
export function buildMesh(grid) {
  const pos = [];
  const uv = [];
  const nCols = cols(grid);
  const nRows = rows(grid);
  const TESS = tessFor(nCols, nRows);

  for (let cy = 0; cy < nRows; cy += 1) {
    for (let cx = 0; cx < nCols; cx += 1) {
      const quad = cellQuad(grid, cx, cy);
      const m = squareToQuad(quad);
      const u0 = grid.us[cx];
      const u1 = grid.us[cx + 1];
      const v0 = grid.vs[cy];
      const v1 = grid.vs[cy + 1];

      // Corner fallback for a degenerate (collinear) cell: plain bilinear.
      const evalAt = (s, t) => {
        if (m) return applyH(m, s, t);
        const top = { x: quad[0].x + (quad[1].x - quad[0].x) * s, y: quad[0].y + (quad[1].y - quad[0].y) * s };
        const bot = { x: quad[3].x + (quad[2].x - quad[3].x) * s, y: quad[3].y + (quad[2].y - quad[3].y) * s };
        return { x: top.x + (bot.x - top.x) * t, y: top.y + (bot.y - top.y) * t };
      };

      for (let j = 0; j < TESS; j += 1) {
        for (let i = 0; i < TESS; i += 1) {
          const s0 = i / TESS;
          const s1 = (i + 1) / TESS;
          const t0 = j / TESS;
          const t1 = (j + 1) / TESS;
          const p00 = evalAt(s0, t0);
          const p10 = evalAt(s1, t0);
          const p11 = evalAt(s1, t1);
          const p01 = evalAt(s0, t1);
          const a00 = [u0 + (u1 - u0) * s0, v0 + (v1 - v0) * t0];
          const a10 = [u0 + (u1 - u0) * s1, v0 + (v1 - v0) * t0];
          const a11 = [u0 + (u1 - u0) * s1, v0 + (v1 - v0) * t1];
          const a01 = [u0 + (u1 - u0) * s0, v0 + (v1 - v0) * t1];

          pos.push(p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
          uv.push(a00[0], a00[1], a10[0], a10[1], a11[0], a11[1]);
          pos.push(p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
          uv.push(a00[0], a00[1], a11[0], a11[1], a01[0], a01[1]);
        }
      }
    }
  }

  return { pos: new Float32Array(pos), uv: new Float32Array(uv), count: pos.length / 2 };
}

/**
 * @param {HTMLCanvasElement} canvas  output canvas (gets the warped image)
 * @returns renderer, or null when WebGL is unavailable (caller falls back to CSS)
 */
export function createMeshWarp(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
  });
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
  } catch (e) {
    return null;
  }

  const aPos = gl.getAttribLocation(program, 'aPos');
  const aUV = gl.getAttribLocation(program, 'aUV');
  const uTex = gl.getUniformLocation(program, 'uTex');
  const posBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  const tex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Canvas rows run top-down, GL textures bottom-up.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  let mesh = null;
  let meshRev = -1;

  const resize = () => {
    const w = Math.max(1, canvas.offsetWidth);
    const h = Math.max(1, canvas.offsetHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  };

  /**
   * @param {HTMLCanvasElement} source  composited image to warp
   * @param {object} grid
   * @param {number} rev  bumped by the caller whenever `grid` changes —
   *   cheaper than hashing the grid every frame, which got measurably
   *   expensive (~1.4ms/frame) once the node count grew.
   */
  const render = (source, grid, rev = 0) => {
    if (!source || !source.width || !source.height) return;
    resize();

    // Rebuild geometry only when the grid actually changed.
    if (rev !== meshRev) {
      mesh = buildMesh(grid);
      meshRev = rev;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
    }
    if (!mesh || !mesh.count) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(uTex, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  };

  const destroy = () => {
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(uvBuf);
    gl.deleteTexture(tex);
    gl.deleteProgram(program);
  };

  return { render, resize, destroy };
}

export { at, cols, rows };
