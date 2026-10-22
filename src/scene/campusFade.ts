import * as THREE from 'three'
import maskJson from '../data/osm/fade-mask.json'
import { project } from '../lib/geo'
import { palette } from './palette'

/**
 * Fades anything outside the campus toward the background color, following
 * the real campus outline (a precomputed distance mask from derive-osm.ts).
 * Patched into materials with `withCampusFade`, so it costs one texture
 * lookup per fragment and nothing per frame.
 */
function decodeMask(): THREE.DataTexture {
  const bin = atob(maskJson.data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const tex = new THREE.DataTexture(bytes, maskJson.size, maskJson.size, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

const [w, s, e, n] = maskJson.bbox
const [x0, n0] = project(w, s)
const [x1, n1] = project(e, n)

const uniforms = {
  uFadeMask: { value: decodeMask() },
  /** x, north, width, height of the mask in local meters. */
  uFadeRect: { value: new THREE.Vector4(x0, n0, x1 - x0, n1 - n0) },
  uFadeColor: { value: new THREE.Color(palette.sky) },
  uFadeStrength: { value: 1 },
}

const VERT_DECL = /* glsl */ `
varying vec2 vCampusXZ;
`
const VERT_MAIN = /* glsl */ `
{
  vec4 cw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cw = instanceMatrix * cw;
  #endif
  cw = modelMatrix * cw;
  vCampusXZ = cw.xz;
}
`
const FRAG_DECL = /* glsl */ `
uniform sampler2D uFadeMask;
uniform vec4 uFadeRect;
uniform vec3 uFadeColor;
uniform float uFadeStrength;
varying vec2 vCampusXZ;
`
const FRAG_MAIN = /* glsl */ `
{
  // Scene z points south, the mask's v axis points north.
  vec2 uv = vec2((vCampusXZ.x - uFadeRect.x) / uFadeRect.z, (-vCampusXZ.y - uFadeRect.y) / uFadeRect.w);
  float inRect = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float m = mix(1.0, texture2D(uFadeMask, clamp(uv, 0.0, 1.0)).r, inRect);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, smoothstep(0.0, 1.0, m) * uFadeStrength);
}
`

/** Extra shader hooks other patches can chain onto. */
export type ShaderPatch = (shader: THREE.WebGLProgramParametersWithUniforms) => void

/** Patch a built-in material to fade outside the campus. Returns the same material. */
export function withCampusFade<M extends THREE.Material>(material: M, extra?: ShaderPatch, key = ''): M {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FRAG_MAIN}`)
    extra?.(shader)
  }
  material.customProgramCacheKey = () => `campus-fade${key}`
  return material
}

/**
 * Horizontal window bands on vertical faces, one per floor. Used for the
 * detailed landmark walls so they read as buildings without textures.
 */
export const windowBands = (glass: THREE.ColorRepresentation, floor = 3.6): ShaderPatch => {
  const glassColor = new THREE.Color(glass)
  return (shader) => {
    shader.uniforms.uGlass = { value: glassColor }
    shader.uniforms.uFloor = { value: floor }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nvarying float vVertical;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
        vVertical = 1.0 - abs(normalize(mat3(modelMatrix) * objectNormal).y);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uGlass;\nuniform float uFloor;\nvarying float vWorldY;\nvarying float vVertical;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float f = fract((vWorldY - 1.4) / uFloor);
          float band = smoothstep(0.30, 0.34, f) * (1.0 - smoothstep(0.70, 0.74, f));
          // Skip the ground-floor plinth so buildings sit on a solid base.
          band *= step(1.2, vWorldY) * step(0.85, vVertical);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, band);
        }`,
      )
  }
}
