#!/usr/bin/env node
// 디자인 토큰 색 검산: tokens.css의 라이트·다크 값을 읽어 대비(WCAG)와 색차(CIEDE2000, 색각 이상 시뮬레이션 포함)를 계산한다.
// 사용: node .claude/skills/db-design-system/scripts/check-palette.mjs [--set dark:--viz-cat-2=#ff8a3d,light:--viz-cat-3=#0b8a8a] [--json out.json]
// 기준(visual-language.md 「색」):
//   1) 범주색 8개는 surface·bg 위 3:1 이상(차트 마크)
//   2) 의미색과 겹치지 않음: 다크 cat-2 ↔ warning, cat-3 ↔ positive(라이트·다크) ΔE00 ≥ 15
//   3) 첫 3색(cat-1~3)은 정상 시각·적색맹·녹색맹 시뮬레이션 모두에서 ΔE00 ≥ 12
//   4) 범주색 쌍 최솟값(정상 시각)이 조정 전보다 작아지지 않음(--set을 줬을 때 조정 전 값과 비교)
//   5) 바꾼 색은 다른 범주색·의미색·강조색과 ΔE00 ≥ 15(새 겹침 없음)
// 대비 3:1은 바꾼 색만 위반으로 세고, 바꾸지 않은 색의 기존 미달은 '참고'로 적는다.
// 종료 코드: 기준 위반이 있으면 1.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const tokensPath = resolve(opt('tokens') ?? 'src/design-system/tokens.css')
const css = readFileSync(tokensPath, 'utf8')

/** 블록 본문에서 --name: #hex 쌍을 읽는다 */
function readVars(body) {
  const out = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2].toLowerCase()
  return out
}
function blockAfter(selectorRe) {
  const m = css.match(selectorRe)
  if (!m) throw new Error(`블록을 찾지 못함: ${selectorRe}`)
  let i = css.indexOf('{', m.index) + 1
  let depth = 1
  const start = i
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') depth--
    i++
  }
  return css.slice(start, i - 1)
}
const light = readVars(blockAfter(/^:root\s*\{/m))
const darkSystem = readVars(blockAfter(/:root:not\(\[data-theme='light'\]\)[^{]*\{/))
const darkForced = readVars(blockAfter(/:root\[data-theme='dark'\][^{]*\{/))

const problems = []
const notes = []
for (const k of new Set([...Object.keys(darkSystem), ...Object.keys(darkForced)])) {
  if (darkSystem[k] !== darkForced[k]) problems.push(`다크 두 블록 값이 다름: ${k} ${darkSystem[k]} vs ${darkForced[k]}`)
}

const before = { light: { ...light }, dark: { ...darkForced } }
const after = { light: { ...light }, dark: { ...darkForced } }
for (const pair of (opt('set') ?? '').split(',').filter(Boolean)) {
  const m = pair.match(/^(light|dark):(--[a-z0-9-]+)=(#[0-9a-fA-F]{6})$/)
  if (!m) throw new Error(`--set 형식 오류: ${pair}`)
  after[m[1]][m[2]] = m[3].toLowerCase()
}

// ---------- 색 계산 ----------
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const lum = (h) => {
  const [r, g, b] = hexRgb(h).map(toLin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
// Machado et al. 2009, 심도 1.0(선형 RGB에 적용)
const CVD = {
  normal: null,
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}
function linRgb(h, sim) {
  const lin = hexRgb(h).map(toLin)
  if (!sim) return lin
  return sim.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))
}
function lab(h, sim) {
  const [r, g, b] = linRgb(h, sim)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
function de2000(h1, h2, sim) {
  const [L1, a1, b1] = lab(h1, sim)
  const [L2, a2, b2] = lab(h2, sim)
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const hp = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360)
  const h1p = hp(a1p, b1)
  const h2p = hp(a2p, b2)
  const dL = L2 - L1
  const dC = C2p - C1p
  let dh = 0
  if (C1p * C2p !== 0) {
    dh = h2p - h1p
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2)
  const Lm = (L1 + L2) / 2
  const Cmp = (C1p + C2p) / 2
  let hm = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hm = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    else hm = (h1p + h2p) / 2
  }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2)
  const Sc = 1 + 0.045 * Cmp
  const Sh = 1 + 0.015 * Cmp * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}
const hue = (h) => {
  const [r, g, b] = hexRgb(h)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx === mn) return 0
  const d = mx - mn
  const v = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round((v * 60 + 360) % 360)
}

// ---------- 검산 ----------
const CATS = Array.from({ length: 8 }, (_, i) => `--viz-cat-${i + 1}`)
const r1 = (v) => Math.round(v * 10) / 10
function evaluate(set) {
  const rows = {}
  for (const mode of ['light', 'dark']) {
    const t = set[mode]
    const m = {}
    m.contrast = Object.fromEntries(CATS.map((k) => [k, { surface: Math.round(contrast(t[k], t['--color-surface']) * 100) / 100, bg: Math.round(contrast(t[k], t['--color-bg']) * 100) / 100 }]))
    m.semantic = {
      'cat-2↔warning': r1(de2000(t['--viz-cat-2'], t['--color-warning'])),
      'cat-2↔negative': r1(de2000(t['--viz-cat-2'], t['--color-negative'])),
      'cat-3↔positive': r1(de2000(t['--viz-cat-3'], t['--color-positive'])),
      'cat-1↔accent': r1(de2000(t['--viz-cat-1'], t['--color-accent'])),
      'accent↔info': r1(de2000(t['--color-accent'], t['--color-info'])),
    }
    m.first3 = {}
    for (const sim of Object.keys(CVD)) {
      const [a, b, c] = CATS.slice(0, 3).map((k) => t[k])
      m.first3[sim] = { '1↔2': r1(de2000(a, b, CVD[sim])), '1↔3': r1(de2000(a, c, CVD[sim])), '2↔3': r1(de2000(b, c, CVD[sim])) }
    }
    let min = { d: Infinity, pair: '' }
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const d = de2000(t[CATS[i]], t[CATS[j]])
        if (d < min.d) min = { d: r1(d), pair: `cat-${i + 1}↔cat-${j + 1}` }
      }
    m.minCatPair = min
    m.neighbors = {
      'cat-2↔cat-5': r1(de2000(t['--viz-cat-2'], t['--viz-cat-5'])),
      'cat-2↔cat-7': r1(de2000(t['--viz-cat-2'], t['--viz-cat-7'])),
      'cat-3↔cat-6': r1(de2000(t['--viz-cat-3'], t['--viz-cat-6'])),
      'cat-3↔cat-1': r1(de2000(t['--viz-cat-3'], t['--viz-cat-1'])),
    }
    m.hue = Object.fromEntries(['--viz-cat-2', '--viz-cat-3', '--color-warning', '--color-positive', '--viz-cat-6'].map((k) => [k, `${t[k]} ${hue(t[k])}°`]))
    rows[mode] = m
  }
  return rows
}
const res = { before: evaluate(before), after: evaluate(after) }

for (const mode of ['light', 'dark']) {
  const a = res.after[mode]
  // 대비 3:1은 이번에 바꾼 토큰만 기준으로 본다. 바꾸지 않은 색의 기존 미달은 참고로만 적는다(팔레트 유지 결정, 2026-10-30)
  for (const [k, v] of Object.entries(a.contrast)) {
    if (v.surface >= 3 && v.bg >= 3) continue
    const changed = before[mode][k] !== after[mode][k]
    if (changed) problems.push(`[${mode}] ${k} 대비 ${v.surface}/${v.bg} < 3`)
    else notes.push(`[${mode}] ${k} 대비 ${v.surface}/${v.bg} < 3 (기존 값, 이번 조정 대상 아님)`)
  }
  if (mode === 'dark' && a.semantic['cat-2↔warning'] < 15) problems.push(`[dark] cat-2↔warning ΔE ${a.semantic['cat-2↔warning']} < 15`)
  if (a.semantic['cat-3↔positive'] < 15) problems.push(`[${mode}] cat-3↔positive ΔE ${a.semantic['cat-3↔positive']} < 15`)
  for (const [sim, v] of Object.entries(a.first3)) for (const [p, d] of Object.entries(v)) if (d < 12) problems.push(`[${mode}/${sim}] 첫 3색 ${p} ΔE ${d} < 12`)
  // 5) 바꾼 색은 다른 범주색·의미색·강조색과 새로 겹치지 않음(ΔE00 ≥ 15)
  const SEM = ['--color-accent', '--color-info', '--color-positive', '--color-negative', '--color-warning']
  for (const k of CATS.filter((c) => before[mode][c] !== after[mode][c])) {
    const t = after[mode]
    const near = [...CATS.filter((c) => c !== k), ...SEM].map((o) => ({ o, d: de2000(t[k], t[o]) })).sort((x, y) => x.d - y.d)[0]
    console.log(`[${mode}] ${k} ${before[mode][k]} → ${t[k]}: 가장 가까운 색 ${near.o} ΔE00 ${near.d.toFixed(2)}`)
    if (near.d < 15) problems.push(`[${mode}] ${k}가 ${near.o}와 가까움 ΔE ${near.d.toFixed(2)} < 15`)
  }
  if (a.minCatPair.d < res.before[mode].minCatPair.d - 0.05) problems.push(`[${mode}] 범주색 쌍 최솟값이 줄어듦 ${res.before[mode].minCatPair.d} → ${a.minCatPair.d} (${a.minCatPair.pair})`)
}

const show = (mode) => {
  const b = res.before[mode]
  const a = res.after[mode]
  console.log(`\n=== ${mode} ===`)
  console.log('의미색·강조색 ΔE00(전 → 후):', Object.keys(a.semantic).map((k) => `${k} ${b.semantic[k]} → ${a.semantic[k]}`).join(' · '))
  console.log('인접 범주 ΔE00:', Object.keys(a.neighbors).map((k) => `${k} ${b.neighbors[k]} → ${a.neighbors[k]}`).join(' · '))
  console.log('첫 3색 ΔE00:', Object.keys(a.first3).map((s) => `${s} [${Object.keys(a.first3[s]).map((p) => `${p} ${b.first3[s][p]}→${a.first3[s][p]}`).join(', ')}]`).join(' '))
  console.log(`범주색 쌍 최솟값: ${b.minCatPair.d} (${b.minCatPair.pair}) → ${a.minCatPair.d} (${a.minCatPair.pair})`)
  console.log('대비(surface/bg):', CATS.map((k) => `${k.slice(6)} ${a.contrast[k].surface}/${a.contrast[k].bg}`).join(' · '))
  console.log('색상각:', Object.values(a.hue).join(' · '))
}
show('light')
show('dark')
if (opt('json')) writeFileSync(opt('json'), JSON.stringify(res, null, 2))
if (notes.length) console.log(`\n참고 ${notes.length}건\n- ${notes.join('\n- ')}`)
console.log(problems.length ? `\n기준 위반 ${problems.length}건\n- ${problems.join('\n- ')}` : '\n기준 위반 0건')
process.exit(problems.length ? 1 : 0)
