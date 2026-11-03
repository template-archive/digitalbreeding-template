/**
 * 유전형 격자(캔버스). 행 = 계통, 열 = 창 SNP 또는 리드 블록 SNP.
 * 위 트랙: 물리 위치 축(Mb)·SNP 연결선·후보 유전자 눈금·리드 SNP 표식·ld-decay 블록 괄호(리드 블록 강조).
 * 왼쪽 띠: 하위 집단 색 + 하플로타입 색. 셀: 주·소수 대립유전자 또는 표적 하플로타입과 같음·다름, 결측은 빗금.
 * 그리기가 끝나면 canvas에 data-chart-ready="true"를 단다(QA 스크린샷 대기 계약).
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useElementWidth, hatchPattern } from '@/design-system'
import { selectionStroke, type ChartTheme } from '@/charts'
import { formatNumber, formatSigned, josa } from '@/lib/format'
import {
  SUBPOP_LABEL,
  TRAIT_SHORT,
  UNDET,
  cellValue,
  kb1,
  type Assign,
  type LocusResult,
  type Subpop,
} from '../data'
import { gridColors, subpopColor, withAlpha } from './colors'
import { withUnit } from './EffectCard'

export interface GridRow {
  key: string
  label: string
  subpop: Subpop
  /** 하위 집단 추정(육종 그룹 기준) */
  subpopEstimated: boolean
  a: Assign
}

export type ColRange = 'window' | 'block'
export type ColorMode = 'allele' | 'compare'

interface Props {
  L: LocusResult
  rows: GridRow[]
  showLabels: boolean
  colRange: ColRange
  colorMode: ColorMode
  highlightHap: string | null
  highlightRow: string | null
  hapColors: Record<string, string | null>
  theme: ChartTheme
  narrow: boolean
  ariaLabel: string
  /** 강조 행 위치(px, 캔버스 위 기준)를 부모에게 알린다(스크롤용) */
  onRowY?: (y: number | null) => void
}

const Y_LABEL = 11
const Y_TRI_TOP = 14
const Y_AXIS = 27
const Y_BRACKET = 47
const Y_BNUM = 59
const Y_CONN_TOP = 64
const Y_CONN_BOT = 92
const SNP_LABEL_H = 92
const MIN_COL = 3

const FONT = "'Pretendard Variable', Pretendard, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

interface Geo {
  x0: number
  colW: number
  cols: number[]
  gridTop: number
  rowH: number
  cssW: number
  cssH: number
  labelW: number
  leadX: number
  axis: { lo: number; hi: number; gx0: number; gx1: number }
}

export function GenotypeGrid({ L, rows, showLabels, colRange, colorMode, highlightHap, highlightRow, hapColors, theme, narrow, ariaLabel, onRowY }: Props) {
  const box = useElementWidth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const geoRef = useRef<Geo | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const hatch = useMemo(() => hatchPattern(theme), [theme])
  const colors = useMemo(() => gridColors(theme), [theme])

  const cols = useMemo(() => {
    if (colRange === 'block') {
      const out: number[] = []
      for (let j = L.leadBlock.from; j <= L.leadBlock.to; j++) out.push(j)
      return out
    }
    return L.snps.map((_, j) => j)
  }, [L, colRange])

  const width = box.width

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || width <= 0) return
    cv.setAttribute('data-chart-ready', 'false')
    const labelW = showLabels ? (narrow ? 118 : 168) : 0
    const x0 = labelW + 24
    const rowH = showLabels ? 14 : 1.5
    const avail = width - x0 - 6
    const colW = Math.max(MIN_COL, avail / cols.length)
    const gridW = colW * cols.length
    const cssW = Math.max(width, Math.ceil(x0 + gridW + 6))
    const gridTop = Y_CONN_BOT + (colRange === 'block' ? SNP_LABEL_H : 0) + 4
    const cssH = Math.ceil(gridTop + rows.length * rowH + 4)
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
    cv.width = Math.round(cssW * dpr)
    cv.height = Math.round(cssH * dpr)
    cv.style.width = `${cssW}px`
    cv.style.height = `${cssH}px`
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const snps = L.snps
    const lb = L.leadBlock
    const colX = (c: number) => x0 + Math.round(c * colW)
    const gap = colW >= 10 ? 1 : 0
    const rowY = (i: number) => gridTop + Math.round(i * rowH)
    const rowGap = rowH >= 10 ? 1 : 0

    // ---- 물리 축 범위 ----
    let aLo = L.lo
    let aHi = L.hi
    if (colRange === 'block') {
      const a = snps[lb.from]!.bp
      const z = snps[lb.to]!.bp
      const pad = Math.max(2000, (z - a) * 0.08)
      aLo = a - pad
      aHi = z + pad
    }
    const gx0 = x0
    const gx1 = x0 + gridW
    const px = (bp: number) => gx0 + ((bp - aLo) / (aHi - aLo)) * (gx1 - gx0)
    const leadX = px(L.planted.bp)
    geoRef.current = { x0, colW, cols, gridTop, rowH, cssW, cssH, labelW, leadX, axis: { lo: aLo, hi: aHi, gx0, gx1 } }

    ctx.font = `11px ${FONT}`
    ctx.textBaseline = 'alphabetic'

    // ---- 리드 블록 열 배경 ----
    const lbCols = cols.map((j, c) => ({ j, c })).filter(x => x.j >= lb.from && x.j <= lb.to)
    if (lbCols.length) {
      const bx0 = colX(lbCols[0]!.c)
      const bx1 = colX(lbCols[lbCols.length - 1]!.c + 1)
      ctx.fillStyle = colors.leadTint
      ctx.fillRect(bx0, Y_CONN_TOP, bx1 - bx0, gridTop - Y_CONN_TOP)
    }

    // ---- 물리 축 ----
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx0, Y_AXIS + 0.5)
    ctx.lineTo(gx1, Y_AXIS + 0.5)
    ctx.stroke()
    const spanMb = (aHi - aLo) / 1e6
    const steps = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5]
    const step = steps.find(s => ((gx1 - gx0) / spanMb) * s >= 64) ?? 0.5
    const dec = step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3
    ctx.fillStyle = theme.textMuted
    ctx.textAlign = 'center'
    for (let v = Math.ceil(aLo / 1e6 / step) * step; v <= aHi / 1e6 + 1e-9; v += step) {
      const x = px(v * 1e6)
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, Y_AXIS)
      ctx.lineTo(Math.round(x) + 0.5, Y_AXIS + 4)
      ctx.stroke()
      // 끝 눈금 라벨이 캔버스 밖으로 잘리지 않게 안쪽으로 민다
      const tick = v.toFixed(dec)
      ctx.fillText(tick, Math.min(x, cssW - 2 - ctx.measureText(tick).width / 2), Y_AXIS + 15)
    }
    ctx.textAlign = 'right'
    ctx.fillText('Mb', gx0 - 4, Y_AXIS + 15)

    // ---- 블록 괄호 ----
    const blocks = colRange === 'block' ? [lb] : L.blocks
    const leadLabel = `B${L.leadBlockNo} · 리드 블록 ${kb1(L.leadBlockKb)} kb`
    ctx.font = `600 11px ${FONT}`
    const llW = ctx.measureText(leadLabel).width
    const lbMid = (px(snps[lb.from]!.bp) + px(snps[lb.to]!.bp)) / 2
    const llX = Math.min(Math.max(lbMid, gx0 + llW / 2), cssW - 4 - llW / 2)
    ctx.font = `11px ${FONT}`
    for (const b of blocks) {
      const isLead = b === lb || (b.from === lb.from && b.to === lb.to)
      const a = px(snps[b.from]!.bp)
      const z = Math.max(px(snps[b.to]!.bp), a + 2)
      ctx.strokeStyle = isLead ? theme.accent : theme.textMuted
      ctx.lineWidth = isLead ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(a, Y_BRACKET + 5)
      ctx.lineTo(a, Y_BRACKET)
      ctx.lineTo(z, Y_BRACKET)
      ctx.lineTo(z, Y_BRACKET + 5)
      ctx.stroke()
      if (!isLead) {
        const no = L.blocks.indexOf(b) + 1
        const t = `B${no}`
        const w = ctx.measureText(t).width
        const mid = (a + z) / 2
        const overlapsLead = Math.abs(mid - llX) < (llW + w) / 2 + 4
        if (z - a >= w + 2 && !overlapsLead) {
          ctx.fillStyle = theme.textMuted
          ctx.textAlign = 'center'
          ctx.fillText(t, mid, Y_BNUM)
        }
      }
    }
    ctx.font = `600 11px ${FONT}`
    ctx.fillStyle = theme.accent
    ctx.textAlign = 'center'
    ctx.fillText(leadLabel, llX, Y_BNUM)

    // ---- 후보 유전자 눈금 ----
    const geneBp = L.planted.geneBp
    const gene = L.planted.gene
    if (geneBp != null && gene) {
      const inRange = geneBp >= aLo && geneBp <= aHi
      const gxp = inRange ? px(geneBp) : geneBp < aLo ? gx0 : gx1
      ctx.strokeStyle = theme.text
      ctx.lineWidth = 1.5
      ctx.setLineDash(inRange ? [] : [2, 2])
      ctx.beginPath()
      ctx.moveTo(gxp, Y_AXIS - 9)
      ctx.lineTo(gxp, Y_AXIS + 6)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `italic 600 11px ${FONT}`
      ctx.fillStyle = theme.text
      const right = geneBp >= L.planted.bp
      ctx.textAlign = right ? 'left' : 'right'
      const out = inRange ? '' : geneBp < aLo ? '← ' : ' →'
      const txt = inRange ? gene : right ? `${gene}${out}` : `${out}${gene}`
      ctx.fillText(txt, gxp + (right ? 5 : -5), Y_AXIS - 3)
    }

    // ---- 다른 리드(C2) 표식 ----
    L.others.forEach((o, k) => {
      if (L.otherIdx[k]! < 0 || o.bp < aLo || o.bp > aHi) return
      const x = px(o.bp)
      ctx.strokeStyle = theme.accent
      ctx.fillStyle = theme.surface
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - 4, Y_TRI_TOP + 5)
      ctx.lineTo(x + 4, Y_TRI_TOP + 5)
      ctx.lineTo(x, Y_AXIS - 1)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.font = `600 11px ${FONT}`
      ctx.fillStyle = theme.accent
      ctx.textAlign = o.bp < L.planted.bp ? 'right' : 'left'
      ctx.fillText(o.id, x + (o.bp < L.planted.bp ? -6 : 6), Y_TRI_TOP + 11)
    })

    // ---- 리드 SNP 표식 ----
    ctx.fillStyle = theme.accent
    ctx.beginPath()
    ctx.moveTo(leadX - 6, Y_TRI_TOP)
    ctx.lineTo(leadX + 6, Y_TRI_TOP)
    ctx.lineTo(leadX, Y_AXIS - 1)
    ctx.closePath()
    ctx.fill()
    const leadId = snps[L.leadIdx]!.id
    const leadText = `${leadId} · −log10 p ${L.planted.logP.toFixed(1)}`
    ctx.font = `700 11px ${FONT}`
    const ltW = ctx.measureText(leadText).width
    const ltX = Math.min(Math.max(leadX, gx0 + ltW / 2), cssW - 4 - ltW / 2)
    ctx.textAlign = 'center'
    ctx.fillText(leadText, ltX, Y_LABEL - 1)

    // ---- 연결선 ----
    ctx.lineWidth = 1
    cols.forEach((j, c) => {
      const inLb = j >= lb.from && j <= lb.to
      ctx.strokeStyle = j === L.leadIdx ? theme.accent : inLb ? withAlpha(theme.accent, 0.55) : withAlpha(theme.textMuted, 0.35)
      const cx = (colX(c) + colX(c + 1)) / 2
      ctx.beginPath()
      ctx.moveTo(px(snps[j]!.bp), Y_CONN_TOP)
      ctx.lineTo(cx, Y_CONN_BOT)
      ctx.stroke()
    })

    // ---- 열 SNP ID(리드 블록 보기) ----
    if (colRange === 'block') {
      ctx.font = `11px ${FONT}`
      cols.forEach((j, c) => {
        const cx = (colX(c) + colX(c + 1)) / 2
        ctx.save()
        ctx.translate(cx + 3.5, Y_CONN_BOT + 4)
        ctx.rotate(Math.PI / 2)
        ctx.textAlign = 'left'
        ctx.fillStyle = j === L.leadIdx ? theme.accent : theme.text
        ctx.font = j === L.leadIdx ? `700 11px ${FONT}` : `11px ${FONT}`
        ctx.fillText(snps[j]!.id, 0, 0)
        ctx.restore()
      })
    }

    // ---- 셀 ----
    const pattern = hatch ? ctx.createPattern(hatch, 'repeat') : null
    const missFill: string | CanvasPattern = pattern ?? theme.surface2
    rows.forEach((r, i) => {
      const y = rowY(i)
      const h = rowY(i + 1) - y - rowGap
      if (h <= 0) return
      // 띠
      ctx.globalAlpha = r.subpopEstimated ? 0.5 : 1
      ctx.fillStyle = subpopColor(theme, r.subpop)
      ctx.fillRect(labelW + 2, y, 8, h)
      ctx.globalAlpha = 1
      const hc = hapColors[r.a.hap]
      ctx.fillStyle = hc ?? missFill
      ctx.fillRect(labelW + 12, y, 8, h)
      for (let c = 0; c < cols.length; c++) {
        const j = cols[c]!
        const v = cellValue(L, r.a, j)
        let fill: string | CanvasPattern
        if (v < 0) fill = missFill
        else if (colorMode === 'allele') fill = v === L.minor[j] ? colors.minor : colors.major
        else fill = v === L.compareRef[j] ? colors.same : colors.diff
        ctx.fillStyle = fill
        const x = colX(c)
        ctx.fillRect(x, y, colX(c + 1) - x - gap, h)
      }
      if (showLabels) {
        ctx.font = r.key === highlightRow ? `700 12px ${FONT}` : `12px ${FONT}`
        ctx.fillStyle = theme.text
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        let t = r.label
        while (ctx.measureText(t).width > labelW - 4 && t.length > 4) t = t.slice(0, -2) + '…'
        ctx.fillText(t, 0, y + h / 2 + 0.5)
        ctx.textBaseline = 'alphabetic'
      }
    })

    // ---- 리드 블록 윤곽·리드 열 표시 ----
    if (lbCols.length) {
      const bx0 = colX(lbCols[0]!.c)
      const bx1 = colX(lbCols[lbCols.length - 1]!.c + 1)
      // 리드 블록 = 데이터 위 선택 규격(표면색 후광 → 글자색 선)
      const ss = selectionStroke(theme)
      ctx.strokeStyle = ss.haloColor
      ctx.lineWidth = ss.haloWidth
      ctx.strokeRect(bx0 - 0.75, gridTop - 0.75, bx1 - bx0 + 0.5, rowY(rows.length) - gridTop + 1.5)
      ctx.strokeStyle = ss.lineColor
      ctx.lineWidth = ss.lineWidth
      ctx.strokeRect(bx0 - 0.75, gridTop - 0.75, bx1 - bx0 + 0.5, rowY(rows.length) - gridTop + 1.5)
    }
    const leadC = cols.indexOf(L.leadIdx)
    if (leadC >= 0) {
      const lmid = (colX(leadC) + colX(leadC + 1)) / 2
      const lhw = Math.min(6, (colX(leadC + 1) - colX(leadC)) / 2 + 1)
      const lx0 = lmid - lhw
      const lx1 = lmid + lhw
      ctx.fillStyle = theme.accent
      ctx.beginPath()
      ctx.moveTo(lx0, gridTop - 5)
      ctx.lineTo(lx1, gridTop - 5)
      ctx.lineTo((lx0 + lx1) / 2, gridTop - 1)
      ctx.closePath()
      ctx.fill()
    }

    // ---- 하이라이트 ----
    if (highlightHap) {
      ctx.fillStyle = withAlpha(theme.surface, 0.78)
      rows.forEach((r, i) => {
        if (r.a.hap === highlightHap) return
        const y = rowY(i)
        ctx.fillRect(0, y, cssW, rowY(i + 1) - y)
      })
    }
    let hiY: number | null = null
    if (highlightRow) {
      const i = rows.findIndex(r => r.key === highlightRow)
      if (i >= 0) {
        const y = rowY(i)
        hiY = y
        // 공통 선택 표시(selectionStroke): 표면색 후광 → 글자색 선, 같은 사각형에 두 번
        const sel = selectionStroke(theme)
        const hh = Math.max(3, rowY(i + 1) - y) + 1
        ctx.strokeStyle = sel.haloColor
        ctx.lineWidth = sel.haloWidth
        ctx.strokeRect(1.5, y - 1, cssW - 3, hh)
        ctx.strokeStyle = sel.lineColor
        ctx.lineWidth = sel.lineWidth
        ctx.strokeRect(1.5, y - 1, cssW - 3, hh)
      }
    }
    onRowY?.(hiY)
    cv.setAttribute('data-chart-ready', 'true')
  }, [L, rows, showLabels, colRange, colorMode, highlightHap, highlightRow, hapColors, theme, narrow, width, cols, hatch, colors, onRowY])

  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const g = geoRef.current
    if (!g) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const outer = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect() ?? rect
    const tx = e.clientX - outer.left
    const ty = e.clientY - outer.top
    const pl = L.planted
    if (y < Y_AXIS + 2 && Math.abs(x - g.leadX) < 9) {
      const geneTxt = L.geneIn ? `${pl.gene} 블록 안` : L.geneOutKb != null ? `${pl.gene} 블록 밖 ${kb1(L.geneOutKb)} kb` : ''
      setTip({ x: tx, y: ty,
        text: `${L.snps[L.leadIdx]!.id} · ${TRAIT_SHORT[pl.trait]} β ${withUnit(formatSigned(pl.beta, 1), pl.trait)} · PVE ${(pl.pve * 100).toFixed(1)}% · −log10 p ${pl.logP.toFixed(1)}${geneTxt ? ` · ${geneTxt}` : ''}`,
      })
      return
    }
    if (y < g.gridTop || x < g.labelW) {
      setTip(null)
      return
    }
    const ri = Math.floor((y - g.gridTop) / g.rowH)
    const r = rows[ri]
    const ci = Math.floor((x - g.x0) / g.colW)
    if (!r) {
      setTip(null)
      return
    }
    const subTxt = `${SUBPOP_LABEL[r.subpop]}${r.subpopEstimated ? '(추정)' : ''}`
    const hapTxt = r.a.hap === UNDET ? '하플로타입 미정' : `하플로타입 ${r.a.hap}${r.a.imputed ? '(결측 보정)' : ''}`
    const imp = r.a.observed ? '' : ' · 6K 칩 → 패널 참조 임퓨테이션(추정)'
    if (ci < 0 || ci >= g.cols.length) {
      setTip({ x: tx, y: ty, text: `${r.label} · ${subTxt} · ${hapTxt}${imp}` })
      return
    }
    const j = g.cols[ci]!
    const s = L.snps[j]!
    const v = cellValue(L, r.a, j)
    let allele = '결측(이형접합 포함)'
    if (v >= 0) {
      allele = v === L.minor[j] ? '소수 대립유전자' : '주 대립유전자'
      if (colorMode === 'compare') allele += v === L.compareRef[j] ? ` · 표적 ${josa(L.repTarget.name, '와과')} 같음` : ` · 표적 ${josa(L.repTarget.name, '와과')} 다름`
    }
    setTip({ x: tx, y: ty, text: `${r.label} · ${subTxt} · ${s.id}(${s.chr}:${formatNumber(s.bp)}) · ${allele} · ${hapTxt}${imp}` })
  }

  return (
    <div ref={box.ref} className="relative w-full min-w-0">
      <div className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel}
          data-chart-ready="false"
          className="block"
          onMouseMove={onMove}
          onMouseLeave={() => setTip(null)}
        />
      </div>
      {tip && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-10 max-w-[340px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-snug text-text shadow-2"
          style={{ left: Math.min(tip.x + 14, Math.max(0, box.width - 340)), top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
