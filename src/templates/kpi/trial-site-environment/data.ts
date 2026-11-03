/**
 * 시험지 기상·환경 — 목업 데이터.
 *
 * 생성 규칙은 명세 `docs/specs/trial-site-environment.md` 「목업 데이터 생성 규칙」과
 * 분석가 검산 참조 구현(gen.mjs·alerts.mjs, 저장소 밖 — 명세 docs/specs/trial-site-environment.md 「검산 기록」)을 그대로 옮겼다.
 * RNG 소비 순서(①~⑧)를 바꾸면 모든 값이 달라진다.
 *
 * 기상 값은 모두 목업(가상 관측)이다. 실제 API로 바꿀 때는 `ENVS`(환경별 일 기상·파생 값)와
 * `ENV_INDEX`(MET 환경 지수)를 실제 자료로 채우면 나머지 요약·상관·경보가 따라 계산된다.
 */
import { MET_ZONE_BY_KEY, MET_ZONES, type MetZoneKey } from '@/charts'
import { createRng } from '@/lib/rng'
import { linearFit, pearson, tTwoSided } from '@/lib/stats'

// ---------------- 상수 ----------------

export const SEED = 20261023
export const WX_SEED = SEED + 7
export const AS_OF = '2026-10-23'
export const YEARS = [2025, 2026] as const
export type Year = (typeof YEARS)[number]
export const DEFAULT_YEAR: Year = 2026

/** 유효적산온도 기준 온도(°C) */
export const GDD_BASE = 10
/** 수확 적기: 출수 후 일평균기온 누적(기준 0 °C) */
export const HARVEST_CUM = 1100
/** 등숙기 길이(출수 다음 날부터, 일) */
export const RIPEN_DAYS = 40
/** 등숙 적온 중앙값(°C), 적온 21~23 */
export const RIPEN_OPT = 22
export const RIPEN_OPT_RANGE = [21, 23] as const
/** 출수 ± 창(일) */
export const WIN_HALF = 15
export const HEAT_T = 33
export const HEAT_STERILE_T = 35
export const COLD_T = 17
/** KPI 눈금 띠(표시용): 평년비 90~110%, 유효적산온도 편차 ±50 °C·일 */
export const NORMAL_BAND = {
  pct: { min: 60, max: 140, lo: 90, hi: 110 },
  gdd: { min: -150, max: 150, lo: -50, hi: 50 },
} as const

/** met-gxe-stability 전체 평균(쌀 수량, 백미 기준) */
export const GRAND_MEAN = 566.4152083

/** 권역 라벨·순서는 MET 공통 정의(@/charts `MET_ZONES`, met-gxe-stability와 같다)를 쓴다 */
export type ZoneKey = MetZoneKey
export const ZONES = MET_ZONES
export const ZONE_BY_KEY = MET_ZONE_BY_KEY

/**
 * met-gxe-stability `ENVS[e].index` 원 실행값 복제(e = t·8 + j, GRAND_MEAN 566.4152083).
 * 출처: src/templates/viz/met-gxe-stability/data.ts — 그 템플릿의 목업이 바뀌면 함께 갱신한다.
 */
export const ENV_INDEX: readonly (readonly number[])[] = [
  [51.13146, -16.25021, 59.98313, 34.48813, -3.18021, 14.51813, -39.73854, -26.51521],
  [31.69146, -16.68021, -4.57021, 14.42813, -22.63188, 46.85313, -57.60687, -65.92021],
]

export interface Site {
  id: string
  name: string
  short: string
  zone: ZoneKey
  lat: number
  lon: number
  /** 평년 근사에 쓴 인근 ASOS 지점 */
  ref: string
  /** 이앙일 MM-DD */
  tp: string
  /** 기준 출수일(가람솔, 평년) MM-DD */
  hd: string
  /** [맑은 날 Tmax − Tmean, Tmean − Tmin] */
  dtr: readonly [number, number]
  /** 4~11월 월평균기온 평년(°C) */
  tmp: readonly number[]
  /** 5~10월 강수량 평년(mm) */
  pr: readonly number[]
  /** 5~10월 일조시간 평년(h) */
  sun: readonly number[]
}

// 평년(1991~2020) 추정: 인근 ASOS 지점 평년값 근사(웹 확인 안 함)
export const SITES: Site[] = [
  { id: 'hwaseong', name: '경기 화성', short: '화성', zone: 'central', lat: 37.2, lon: 126.83, ref: '수원', tp: '05-22', hd: '08-14', dtr: [5.0, 4.6],
    tmp: [12.5, 18.0, 22.4, 25.4, 26.1, 21.5, 14.9, 7.4], pr: [95, 128, 350, 300, 140, 52], sun: [225, 195, 150, 170, 180, 195] },
  { id: 'icheon', name: '경기 이천', short: '이천', zone: 'central', lat: 37.27, lon: 127.44, ref: '이천', tp: '05-20', hd: '08-14', dtr: [5.2, 4.8],
    tmp: [12.2, 17.8, 22.2, 25.3, 25.8, 20.9, 14.0, 6.6], pr: [100, 140, 360, 310, 145, 55], sun: [215, 185, 140, 165, 170, 185] },
  { id: 'dangjin', name: '충남 당진', short: '당진', zone: 'central', lat: 36.89, lon: 126.63, ref: '서산', tp: '05-24', hd: '08-15', dtr: [4.8, 4.4],
    tmp: [11.3, 17.0, 21.4, 24.9, 25.8, 21.4, 15.1, 7.9], pr: [92, 118, 265, 270, 150, 55], sun: [240, 210, 160, 185, 195, 205] },
  { id: 'yesan', name: '충남 예산', short: '예산', zone: 'central', lat: 36.68, lon: 126.85, ref: '홍성', tp: '05-23', hd: '08-15', dtr: [5.0, 4.6],
    tmp: [11.8, 17.4, 21.8, 25.2, 25.8, 21.2, 14.6, 7.3], pr: [95, 135, 290, 285, 140, 55], sun: [225, 195, 148, 172, 180, 195] },
  { id: 'cheongju', name: '충북 청주', short: '청주', zone: 'central', lat: 36.64, lon: 127.49, ref: '청주', tp: '05-21', hd: '08-13', dtr: [5.0, 4.6],
    tmp: [13.1, 18.7, 23.0, 26.0, 26.4, 21.8, 15.0, 7.4], pr: [95, 150, 305, 280, 140, 50], sun: [220, 190, 145, 170, 175, 190] },
  { id: 'gimje', name: '전북 김제', short: '김제', zone: 'south', lat: 35.8, lon: 126.88, ref: '부안', tp: '05-28', hd: '08-17', dtr: [5.0, 4.6],
    tmp: [13.2, 18.6, 22.8, 26.0, 26.6, 22.1, 15.6, 8.6], pr: [92, 160, 285, 290, 125, 52], sun: [210, 180, 145, 175, 175, 190] },
  { id: 'miryang', name: '경남 밀양', short: '밀양', zone: 'south', lat: 35.5, lon: 128.75, ref: '밀양', tp: '05-30', hd: '08-18', dtr: [5.4, 5.0],
    tmp: [14.0, 19.3, 23.1, 26.3, 26.9, 22.3, 16.0, 9.0], pr: [105, 165, 265, 255, 160, 48], sun: [205, 175, 150, 180, 165, 185] },
  { id: 'cheorwon', name: '강원 철원', short: '철원', zone: 'north', lat: 38.15, lon: 127.31, ref: '철원', tp: '05-14', hd: '08-10', dtr: [5.6, 5.6],
    tmp: [10.6, 16.5, 21.0, 24.2, 24.6, 19.3, 12.1, 4.6], pr: [110, 145, 430, 360, 145, 48], sun: [225, 190, 135, 160, 175, 195] },
]
export const SITE_BY_ID = Object.fromEntries(SITES.map(s => [s.id, s])) as Record<string, Site>
export const DEFAULT_SITE = 'hwaseong'

export const RAIN_DAYS = [8.5, 10, 15, 14, 9, 6.5]
export const MONTH_DAYS = [31, 30, 31, 31, 30, 31] // 5~10월
export const MONTH_START = [0, 31, 61, 92, 123, 153] // 5/1 = 0
export const MONTH_LABELS = ['5월', '6월', '7월', '8월', '9월', '10월']
export const N_DAYS = 184
const MIDS = [-15.5, 15, 45.5, 76, 107, 137.5, 168, 199.5] // 4~11월 중앙(5/1 = 0)

export const toIdx = (mmdd: string) => {
  const [m, d] = mmdd.split('-').map(Number) as [number, number]
  return MONTH_START[m - 5]! + d - 1
}
export const monthOf = (k: number) => {
  let m = 0
  while (m < 5 && k >= MONTH_START[m + 1]!) m++
  return m
}
/** 날짜 인덱스 → 'MM-DD' */
export const mmdd = (k: number) => {
  const m = monthOf(k)
  const d = k - MONTH_START[m]! + 1
  return `${String(m + 5).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
export const toDate = (y: number, k: number) => `${y}-${mmdd(k)}`

function interpMonthly(vals8: readonly number[], k: number): number {
  for (let i = 0; i < MIDS.length - 1; i++)
    if (k >= MIDS[i]! && k <= MIDS[i + 1]!) {
      const w = (k - MIDS[i]!) / (MIDS[i + 1]! - MIDS[i]!)
      return vals8[i]! * (1 - w) + vals8[i + 1]! * w
    }
  return vals8[7]!
}

/**
 * 월평균 보존 보간용 중앙값(정리 회차 3). 월 중앙값을 그대로 선형 보간하면 여름 정점이 깎여 월평균이
 * 입력 평년보다 낮아진다(8월 −0.6~−0.7 °C). 5~10월 6개 값을 Jacobi 반복으로 보정해 일별 보간의
 * 월평균이 입력 평년과 같게 한다. 4·11월 값은 고정(창 밖).
 */
export const CLIM_ITER = 30
export function climMids(vals8: readonly number[]): number[] {
  const v = vals8.slice()
  for (let it = 0; it < CLIM_ITER; it++) {
    const means = MONTH_START.map((st, m) => {
      let acc = 0
      for (let k = st; k < st + MONTH_DAYS[m]!; k++) acc += interpMonthly(v, k)
      return acc / MONTH_DAYS[m]!
    })
    for (let m = 0; m < 6; m++) v[m + 1] = v[m + 1]! + (vals8[m + 1]! - means[m]!)
  }
  return v
}

type WxEvent = { kind: 'heat' | 'cold'; from: number; days: number; dT: number } | { kind: 'rain'; date: string; mm: number }
interface Scenario {
  dT: number[]
  rain: number[]
  sun: number[]
  ev: WxEvent[]
}

/** 기상 시나리오 SCEN[t][j] */
const SCEN: Scenario[][] = [
  [
    // 2025
    { dT: [0.3, 0.4, 0.6, 0.5, 0.3, 0.3], rain: [1, 0.9, 0.9, 0.9, 0.8, 1], sun: [1.02, 1.05, 1.05, 1.08, 1.15, 1.05], ev: [] },
    { dT: [0.2, 0.3, 0.5, 0.6, 0.2, 0.2], rain: [1, 1, 1.05, 1.1, 1.05, 1], sun: [1, 1, 0.98, 0.97, 0.95, 1], ev: [] },
    { dT: [0.3, 0.4, 0.5, 0.4, 0.4, 0.3], rain: [0.9, 0.9, 0.85, 0.8, 0.75, 0.9], sun: [1.05, 1.05, 1.08, 1.15, 1.18, 1.05], ev: [] },
    { dT: [0.3, 0.4, 0.6, 0.5, 0.3, 0.3], rain: [1, 0.95, 0.9, 0.9, 0.85, 1], sun: [1.02, 1.03, 1.05, 1.1, 1.12, 1.02], ev: [] },
    { dT: [0.3, 0.5, 0.8, 0.9, 0.4, 0.3], rain: [1, 1, 1, 1, 1, 1], sun: [1, 1, 1, 1.02, 1.0, 1], ev: [] },
    { dT: [0.4, 0.5, 0.8, 0.8, 0.5, 0.3], rain: [1, 1, 0.95, 0.95, 0.9, 1], sun: [1, 1.02, 1.02, 1.05, 1.06, 1], ev: [] },
    { dT: [0.5, 0.6, 1.0, 1.0, 0.6, 0.4], rain: [1, 1, 0.9, 0.8, 1, 1], sun: [1, 1, 1.05, 1.05, 1.0, 1], ev: [{ kind: 'heat', from: -5, days: 6, dT: 2.2 }] },
    { dT: [0.0, 0.1, 0.0, -0.8, -0.5, 0.0], rain: [1, 1, 1.05, 1.1, 1, 1], sun: [1, 1, 0.97, 0.95, 0.97, 1], ev: [{ kind: 'cold', from: -13, days: 4, dT: -3.5 }] },
  ],
  [
    // 2026
    { dT: [0.1, 0.2, 0.3, 0.3, 0.2, 0.2], rain: [1, 1, 1.1, 1.1, 0.9, 1], sun: [1, 1, 0.98, 1.0, 1.06, 1], ev: [] },
    { dT: [0.1, 0.2, 0.2, 0.0, 0.0, 0.1], rain: [1, 1, 1.1, 1.3, 1.1, 1], sun: [1, 0.98, 0.95, 0.9, 0.93, 1], ev: [] },
    { dT: [0.1, 0.2, 0.3, 0.1, -0.2, 0.1], rain: [1, 1, 1.1, 1.4, 1.2, 1], sun: [1, 1, 0.96, 0.88, 0.84, 1], ev: [{ kind: 'rain', date: '09-03', mm: 205 }] },
    { dT: [0.1, 0.2, 0.3, 0.2, 0.1, 0.1], rain: [1, 1, 1.05, 1.1, 1.0, 1], sun: [1, 1, 0.98, 0.97, 0.97, 1], ev: [] },
    { dT: [0.1, 0.2, 0.2, -0.3, -0.3, 0.1], rain: [1, 1, 1.15, 1.6, 1.3, 1], sun: [1, 0.98, 0.92, 0.75, 0.82, 1], ev: [] },
    { dT: [0.2, 0.3, 0.4, 0.3, 0.1, 0.2], rain: [1, 1, 0.95, 0.85, 0.75, 1], sun: [1, 1.02, 1.05, 1.1, 1.15, 1.02], ev: [] },
    { dT: [0.4, 0.6, 1.2, 1.5, 1.0, 0.5], rain: [1, 1, 0.85, 0.7, 0.9, 1], sun: [1, 1.02, 1.08, 1.1, 1.0, 1], ev: [{ kind: 'heat', from: -7, days: 12, dT: 3.0 }] },
    { dT: [-0.2, -0.3, -0.4, -1.2, -1.0, -0.4], rain: [1, 1.05, 1.15, 1.2, 1.1, 1], sun: [1, 0.97, 0.92, 0.85, 0.85, 1], ev: [{ kind: 'cold', from: -14, days: 9, dT: -3.0 }] },
  ],
]

const mean = (a: readonly number[]) => a.reduce((x, y) => x + y, 0) / a.length
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)

// ---------------- 타입 ----------------

export interface Day {
  k: number
  m: number
  wet: boolean
  tmean: number
  tmax: number
  tmin: number
  /** 일 강수량(mm) */
  pr: number
  /** 일 일조시간(h) */
  sun: number
  /** 평년 일평균기온 */
  clim: number
  climPr: number
  climSun: number
}

export interface Monthly {
  t: number
  tN: number
  pr: number
  prN: number
  sun: number
  sunN: number
}

export interface Env {
  t: number
  j: number
  e: number
  year: Year
  site: Site
  /** 환경 지수(kg/10a) */
  index: number
  days: Day[]
  /** 이앙·출수·수확 날짜 인덱스 */
  tp: number
  hd: number
  hv: number
  seasonDays: number
  gdd: number
  gddN: number
  pr: number
  prN: number
  sun: number
  sunN: number
  heat: number
  heat35: number
  cold: number
  /** 출수 전 15일~출수일 Tmin ≤ 17 °C 일수 */
  coldPre: number
  t40: number
  t40N: number
  s40: number
  s40N: number
  dev40: number
  monthly: Monthly[]
}

// ---------------- 생성 ----------------

function generate(): Env[] {
  const rng = createRng(WX_SEED)
  const out: Env[] = []
  for (let t = 0; t < 2; t++)
    for (let j = 0; j < 8; j++) {
      const s = SITES[j]!
      const sc = SCEN[t]![j]!
      const dT8 = [sc.dT[0]!, ...sc.dT, sc.dT[5]!]
      const hdBase = toIdx(s.hd)
      const mids = climMids(s.tmp)
      let ar = 0
      const days: (Day & { prRaw: number; sunRaw: number })[] = []
      for (let k = 0; k < N_DAYS; k++) {
        const m = monthOf(k)
        const clim = interpMonthly(mids, k)
        const anom = interpMonthly(dT8, k)
        ar = 0.7 * ar + rng.normal(0, 0.9) // ①
        let bump = 0
        let heatEv = false
        for (const ev of sc.ev)
          if (ev.kind !== 'rain') {
            const st = hdBase + ev.from
            if (k >= st && k < st + ev.days) {
              bump += ev.dT
              if (ev.kind === 'heat') heatEv = true
            }
          }
        const tmean = clim + anom + ar + bump
        const pp = RAIN_DAYS[m]! / MONTH_DAYS[m]!
        const rainEv = sc.ev.some(ev => ev.kind === 'rain' && toIdx(ev.date) === k)
        const wet = rng.next() < pp * (heatEv ? 0.3 : 1) || rainEv // ②
        const u = rng.next() // ③
        const prRaw = wet ? -Math.log(1 - u) : 0
        const kDry = (1 - 0.25 * pp) / (1 - pp)
        const sunRaw = Math.max(0, (wet ? 0.25 : kDry) + rng.normal(0, 0.2)) // ④
        const tmax = tmean + (wet ? 2.8 : s.dtr[0]) + rng.normal(0, 0.8) // ⑤
        const tmin = tmean - (wet ? 2.0 : s.dtr[1]) + rng.normal(0, 0.8) // ⑥
        days.push({ k, m, wet, tmean, tmax, tmin, prRaw, sunRaw, pr: 0, sun: 0, clim, climPr: s.pr[m]! / MONTH_DAYS[m]!, climSun: s.sun[m]! / MONTH_DAYS[m]! })
      }
      // 월 합 척도화: 목표 = 평년 × 시나리오 배율 × 월 잡음
      for (let m = 0; m < 6; m++) {
        const prTarget = s.pr[m]! * sc.rain[m]! * Math.exp(rng.normal(0, 0.15)) // ⑦
        const sunTarget = s.sun[m]! * sc.sun[m]! * (1 + rng.normal(0, 0.04)) // ⑧
        const md = days.filter(d => d.m === m)
        const prSum = sum(md.map(d => d.prRaw))
        const sunSum = sum(md.map(d => d.sunRaw))
        for (const d of md) {
          d.pr = prSum > 0 ? (d.prRaw * prTarget) / prSum : 0
          d.sun = Math.min(13.5, sunSum > 0 ? (d.sunRaw * sunTarget) / sunSum : 0)
        }
      }
      for (const ev of sc.ev) if (ev.kind === 'rain') days[toIdx(ev.date)]!.pr += ev.mm

      const jj = days.slice(MONTH_START[1], MONTH_START[3])
      const jjAnom = mean(jj.map(d => d.tmean - d.clim))
      const shift = Math.max(-5, Math.min(5, -Math.round(1.5 * jjAnom)))
      const hd = hdBase + shift
      let cum = 0
      let hv = -1
      for (let k = hd + 1; k < N_DAYS; k++) {
        cum += days[k]!.tmean
        if (cum >= HARVEST_CUM) {
          hv = k
          break
        }
      }
      const tp = toIdx(s.tp)
      const season = days.slice(tp, hv + 1)
      const win = days.slice(hd - WIN_HALF, hd + WIN_HALF + 1)
      const pre = days.slice(hd - WIN_HALF, hd + 1)
      const rip = days.slice(hd + 1, hd + RIPEN_DAYS + 1)
      const t40 = mean(rip.map(d => d.tmean))
      out.push({
        t,
        j,
        e: t * 8 + j,
        year: YEARS[t]!,
        site: s,
        index: ENV_INDEX[t]![j]!,
        days: days.map(({ prRaw: _p, sunRaw: _s, ...d }) => d),
        tp,
        hd,
        hv,
        seasonDays: hv - tp + 1,
        gdd: sum(season.map(d => Math.max(0, d.tmean - GDD_BASE))),
        gddN: sum(season.map(d => Math.max(0, d.clim - GDD_BASE))),
        pr: sum(season.map(d => d.pr)),
        prN: sum(season.map(d => d.climPr)),
        sun: sum(season.map(d => d.sun)),
        sunN: sum(season.map(d => d.climSun)),
        heat: win.filter(d => d.tmax >= HEAT_T).length,
        heat35: win.filter(d => d.tmax >= HEAT_STERILE_T).length,
        cold: win.filter(d => d.tmin <= COLD_T).length,
        coldPre: pre.filter(d => d.tmin <= COLD_T).length,
        t40,
        t40N: mean(rip.map(d => d.clim)),
        s40: sum(rip.map(d => d.sun)),
        s40N: sum(rip.map(d => d.climSun)),
        dev40: Math.abs(t40 - RIPEN_OPT),
        monthly: MONTH_START.map((st, m) => {
          const md = days.slice(st, st + MONTH_DAYS[m]!)
          return { t: mean(md.map(d => d.tmean)), tN: mean(md.map(d => d.clim)), pr: sum(md.map(d => d.pr)), prN: s.pr[m]!, sun: sum(md.map(d => d.sun)), sunN: s.sun[m]! }
        }),
      })
    }
  return out
}

export const ENVS: Env[] = generate()
export const envOf = (year: Year, siteId: string) => ENVS.find(e => e.year === year && e.site.id === siteId)!
export const envsOf = (year: Year) => ENVS.filter(e => e.year === year)
export const envLabel = (e: Env) => `${e.site.short} ${e.year}`

// ---------------- 이상 기상 경보 ----------------

export type AlertType = 'heat35' | 'coldMeiosis' | 'heavyRain' | 'sun40' | 'gddDef'
export const ALERT_LABEL: Record<AlertType, string> = {
  heat35: '고온 불임 위험',
  coldMeiosis: '장해형 냉해 위험',
  heavyRain: '호우',
  sun40: '등숙기 일조 부족',
  gddDef: '유효적산온도 부족',
}
/** 경보 임계(추정). 호우는 호우주의보·경보(12시간 110·180 mm)를 일 강수량으로 근사 */
export const ALERT_RULES = {
  heat35: { warn: 1, crit: 3 },
  coldMeiosis: { warn: 1, crit: 3 },
  heavyRain: { warn: 110, crit: 180 },
  sun40: { warn: 90, crit: 80 },
  gddDef: { warn: -100 },
} as const

export interface WxAlert {
  id: string
  env: Env
  type: AlertType
  severity: 'warning' | 'critical'
  /** YYYY-MM-DD */
  date: string
  k: number
  n?: number
  max?: number
  min?: number
  mm?: number
  pct?: number
  dev?: number
}

function alertsOf(e: Env): WxAlert[] {
  const out: WxAlert[] = []
  const y = e.year
  const base = (type: AlertType, k: number, severity: WxAlert['severity']) => ({ id: `${e.e}-${type}-${k}`, env: e, type, severity, date: toDate(y, k), k })
  const win = e.days.slice(e.hd - WIN_HALF, e.hd + WIN_HALF + 1)
  const h35 = win.filter(d => d.tmax >= HEAT_STERILE_T)
  if (h35.length >= ALERT_RULES.heat35.warn)
    out.push({ ...base('heat35', h35[0]!.k, h35.length >= ALERT_RULES.heat35.crit ? 'critical' : 'warning'), n: h35.length, max: Math.max(...win.map(d => d.tmax)) })
  const pre = e.days.slice(e.hd - WIN_HALF, e.hd + 1)
  const c17 = pre.filter(d => d.tmin <= COLD_T)
  if (c17.length >= ALERT_RULES.coldMeiosis.warn)
    out.push({ ...base('coldMeiosis', c17[0]!.k, c17.length >= ALERT_RULES.coldMeiosis.crit ? 'critical' : 'warning'), n: c17.length, min: Math.min(...pre.map(d => d.tmin)) })
  for (const d of e.days.slice(e.tp, e.hv + 1))
    if (d.pr >= ALERT_RULES.heavyRain.warn) out.push({ ...base('heavyRain', d.k, d.pr >= ALERT_RULES.heavyRain.crit ? 'critical' : 'warning'), mm: d.pr })
  const sr = (100 * e.s40) / e.s40N
  if (sr <= ALERT_RULES.sun40.warn) out.push({ ...base('sun40', e.hd + RIPEN_DAYS, sr <= ALERT_RULES.sun40.crit ? 'critical' : 'warning'), pct: sr })
  const gd = e.gdd - e.gddN
  if (gd <= ALERT_RULES.gddDef.warn) out.push({ ...base('gddDef', e.hv, 'warning'), dev: gd })
  return out
}

/** 연도별 경보(날짜 내림차순, 같은 날이면 환경 순) */
export const ALERTS: Record<Year, WxAlert[]> = {
  2025: envsOf(2025).flatMap(alertsOf).sort((a, b) => b.k - a.k || a.env.j - b.env.j),
  2026: envsOf(2026).flatMap(alertsOf).sort((a, b) => b.k - a.k || a.env.j - b.env.j),
}
export const alertsOfEnv = (e: Env) => ALERTS[e.year].filter(a => a.env === e)

// ---------------- 연도 요약 ----------------

export interface YearSummary {
  year: Year
  gdd: number
  /** 평균(GDD − 평년 GDD), 원값 */
  gddDev: number
  pr: number
  prPct: number
  sun: number
  sunPct: number
  s40Pct: number
  heat: number
  heat35: number
  cold: number
  alerts: number
  critical: number
  warning: number
  indexMean: number
}

function summarize(year: Year): YearSummary {
  const es = envsOf(year)
  const al = ALERTS[year]
  return {
    year,
    gdd: mean(es.map(e => e.gdd)),
    gddDev: mean(es.map(e => e.gdd - e.gddN)),
    // 평년비 = 평균 실측 / 평균 평년(= Σ/Σ), 지역 % 평균이 아님
    pr: mean(es.map(e => e.pr)),
    prPct: (100 * sum(es.map(e => e.pr))) / sum(es.map(e => e.prN)),
    sun: mean(es.map(e => e.sun)),
    sunPct: (100 * sum(es.map(e => e.sun))) / sum(es.map(e => e.sunN)),
    s40Pct: (100 * sum(es.map(e => e.s40))) / sum(es.map(e => e.s40N)),
    heat: sum(es.map(e => e.heat)),
    heat35: sum(es.map(e => e.heat35)),
    cold: sum(es.map(e => e.cold)),
    alerts: al.length,
    critical: al.filter(a => a.severity === 'critical').length,
    warning: al.filter(a => a.severity === 'warning').length,
    indexMean: mean(es.map(e => e.index)),
  }
}
export const SUMMARY: Record<Year, YearSummary> = { 2025: summarize(2025), 2026: summarize(2026) }

// ---------------- 상관·회귀 ----------------

export type FactorKey = 'gdd' | 'pr' | 'sun' | 's40' | 'heat' | 'cold' | 't40' | 'dev40'
export const FACTORS: { key: FactorKey; label: string; unit: string; digits: number; axis: string }[] = [
  { key: 'gdd', label: '유효적산온도', unit: '°C·일', digits: 0, axis: '유효적산온도 (°C·일, 기준 10 °C)' },
  { key: 'pr', label: '강수량', unit: 'mm', digits: 0, axis: '재배기 강수량 (mm)' },
  { key: 'sun', label: '일조시간', unit: 'h', digits: 0, axis: '재배기 일조시간 (h)' },
  { key: 's40', label: '등숙기 일조시간', unit: 'h', digits: 0, axis: '등숙기 일조시간 (h, 출수 후 1~40일)' },
  { key: 'heat', label: '고온 일수', unit: '일', digits: 0, axis: '고온 일수 (출수 ±15일 최고 ≥ 33 °C, 일)' },
  { key: 'cold', label: '저온 일수', unit: '일', digits: 0, axis: '저온 일수 (출수 ±15일 최저 ≤ 17 °C, 일)' },
  { key: 't40', label: '등숙기 평균기온', unit: '°C', digits: 1, axis: '등숙기 평균기온 (°C)' },
  { key: 'dev40', label: '등숙기 적온 이탈', unit: '°C', digits: 1, axis: '등숙기 적온 이탈 |T − 22| (°C)' },
]
export const DEFAULT_FACTOR: FactorKey = 's40'
export const N_ENV = ENVS.length
export const DF = N_ENV - 2

/** 상관 계수의 양측 p(t = r·√(df/(1 − r²)), @/lib/stats tTwoSided — met-gxe-stability와 같은 불완전 베타) */
const pOfR = (r: number) => tTwoSided(Math.abs(r * Math.sqrt(DF / (1 - r * r))), DF)

/** p = 0.05가 되는 |r|(이분법) */
export const R_CRIT = (() => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (pOfR(mid) > 0.05) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()

export interface Correlation {
  key: FactorKey
  label: string
  r: number
  p: number
  /** 회귀 절편·기울기 y = a + b·x */
  a: number
  b: number
  r2: number
  min: number
  max: number
  sig: boolean
  /** 잔차(ENVS 순서) */
  resid: number[]
}

export const CORRELATIONS: Correlation[] = FACTORS.map(f => {
  const x = ENVS.map(e => e[f.key])
  const y = ENVS.map(e => e.index)
  const r = pearson(x, y)
  const { slope: b, intercept: a } = linearFit(x, y)
  const p = pOfR(r)
  return { key: f.key, label: f.label, r, p, a, b, r2: r * r, min: Math.min(...x), max: Math.max(...x), sig: p < 0.05, resid: x.map((xi, i) => y[i]! - (a + b * xi)) }
})
export const CORR_BY_KEY = Object.fromEntries(CORRELATIONS.map(c => [c.key, c])) as Record<FactorKey, Correlation>
export const FACTOR_BY_KEY = Object.fromEntries(FACTORS.map(f => [f.key, f])) as Record<FactorKey, (typeof FACTORS)[number]>

/** 잔차 하위 n개 환경(가장 음수부터) */
export function lowestResiduals(key: FactorKey, n = 4): { env: Env; resid: number }[] {
  const c = CORR_BY_KEY[key]
  return ENVS.map((env, i) => ({ env, resid: c.resid[i]! }))
    .sort((a, b) => a.resid - b.resid)
    .slice(0, n)
}

/** 환경 지수 범위 */
export const INDEX_MIN = ENVS.reduce((a, b) => (b.index < a.index ? b : a))
export const INDEX_MAX = ENVS.reduce((a, b) => (b.index > a.index ? b : a))
export const INDEX_ABS_MAX = Math.max(Math.abs(INDEX_MIN.index), Math.abs(INDEX_MAX.index))

// ---------------- DEV 검산 ----------------

if (import.meta.env.DEV) {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
  console.assert(near(SUMMARY[2025].indexMean, 9.30458, 1e-4) && near(SUMMARY[2026].indexMean, -9.30458, 1e-4), `[검산] 연도 평균 환경 지수 ${SUMMARY[2025].indexMean} / ${SUMMARY[2026].indexMean} ≠ ±9.30458`)
  console.assert(SUMMARY[2026].alerts === 12 && SUMMARY[2026].critical === 4, `[검산] 2026 경보 ${SUMMARY[2026].alerts}건(경보 ${SUMMARY[2026].critical}) ≠ 12건(경보 4)`)
  console.assert(SUMMARY[2025].alerts === 5 && SUMMARY[2025].critical === 1, `[검산] 2025 경보 ${SUMMARY[2025].alerts}건(경보 ${SUMMARY[2025].critical}) ≠ 5건(경보 1)`)
  console.assert(near(CORR_BY_KEY.s40.r, 0.728598, 1e-4), `[검산] 등숙기 일조 r ${CORR_BY_KEY.s40.r} ≠ 0.728598`)
  console.assert(near(CORR_BY_KEY.s40.a, -184.907089, 1e-3) && near(CORR_BY_KEY.s40.b, 0.79536, 1e-5), `[검산] 등숙기 일조 회귀 ${CORR_BY_KEY.s40.a} + ${CORR_BY_KEY.s40.b}x ≠ −184.907 + 0.79536x`)
  console.assert(near(R_CRIT, 0.49731, 1e-4), `[검산] 유의 임계 |r| ${R_CRIT} ≠ 0.49731`)
  console.assert(ENVS.every(e => e.hv >= 0 && e.hv <= N_DAYS - 1), '[검산] 수확일이 10/31을 넘는 환경이 있음')
  console.assert(ENVS.every(e => e.hd - WIN_HALF >= 0 && e.hd + WIN_HALF <= N_DAYS - 1), '[검산] 출수 ±15일 창이 5/1~10/31 밖으로 나감')
  console.assert(near(SUMMARY[2026].gdd, 1809.458, 1e-3) && near(SUMMARY[2026].gddDev, 31.3774, 1e-3), `[검산] 2026 GDD ${SUMMARY[2026].gdd}(${SUMMARY[2026].gddDev}) ≠ 1809.4580(+31.3774)`)
  console.assert(ALERTS[2026][0]?.type === 'gddDef' && ALERTS[2026][0]?.env.site.id === 'cheorwon', '[검산] 2026 경보 첫 항목이 철원 유효적산온도 부족이 아님')
  const hw = envOf(2026, 'hwaseong').monthly[2]!
  console.assert(near(hw.t, 26.4159, 1e-3) && near(hw.pr, 442.987, 1e-2), `[검산] 화성 2026 7월 ${hw.t} °C · ${hw.pr} mm ≠ 26.4159 · 442.987`)
  // 정리 회차 3: 월 평년 기온 = 입력 평년(월평균 보존 보간), 철원 2026 냉해 최저 13~14 °C대·4일
  console.assert(ENVS.every(e => e.monthly.every((m, i) => near(m.tN, e.site.tmp[i + 1]!, 1e-9))), '[검산] 월 평년 기온이 입력 tmp와 다름(월평균 보존 보간)')
  const cw = envOf(2026, 'cheorwon')
  const cwMin = Math.min(...cw.days.slice(cw.hd - WIN_HALF, cw.hd + 1).map(x => x.tmin))
  console.assert(cw.coldPre === 4 && cwMin >= 13 && cwMin < 14 && near(cw.gdd - cw.gddN, -106.116, 1e-2), `[검산] 철원 2026 냉해 ${cw.coldPre}일·최저 ${cwMin}·GDD 편차 ${cw.gdd - cw.gddN} ≠ 4일·13.17·−106.12`)
}
