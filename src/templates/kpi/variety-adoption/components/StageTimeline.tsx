import { ScrollRegion, cn, stripeBg } from '@/design-system'
import {
  BYEOLHARANG,
  CUR,
  EMPTY_FROM,
  LAST_P3_YEAR,
  REVIEW_YEARS,
  STAGES,
  STD_LAG,
  TIMELINE_YEARS,
  UNDER_REVIEW,
  VARIETIES,
  firstFarmYear,
  lagOf,
  pilotHa,
  regYearOf,
  stageOf,
  stdFarmYear,
  type Variety,
} from '../data'
import { josa } from '@/lib/format'
import { STAGE_VAR, ha, n, stageAmount } from './fmt'

const PLAN_SWATCH = 'var(--color-text-muted)'

function cellTitle(v: Variety, y: number) {
  const st = stageOf(v, y)
  const p = pilotHa(v, y)
  const parts = st.map(s => {
    const label = STAGES.find(x => x.key === s.key)!.label
    const seed = s.seedHa !== null ? ` · 채종 면적 ${n(s.seedHa, s.seedHa < 1 ? 2 : 1)} ha` : ''
    return `${label} ${stageAmount(s.key, s.amount)}${seed}${s.pre ? ' · 사전 증식(계획)' : s.planned ? ' · 계획' : ''}`
  })
  if (p > 0) parts.push(`시범 재배 ${ha(p)} ha${y > CUR ? '(계획)' : ''}`)
  return parts
}

/** 기준 연도의 가장 앞선 단계 문구. 문자는 이 칸에만 쓴다 */
function currentStage(v: Variety) {
  const st = stageOf(v, CUR)
  const last = st[st.length - 1]
  const pilot = pilotHa(v, CUR)
  const main = last ? `${STAGES.find(x => x.key === last.key)!.label} ${stageAmount(last.key, last.amount)}` : null
  const trial = pilot > 0 ? `시범 ${ha(pilot)} ha` : null
  return [main, trial].filter(Boolean).join(' + ')
}

/** 단계 색 띠: 왼쪽부터 기본식물 → 농가 재배 다섯 칸. 확정 = 단계 색, 계획 = 같은 색 빗금, 시범 재배 = 점선 테두리 */
function StageStrip({ v, y, className }: { v: Variety; y: number; className?: string }) {
  const st = stageOf(v, y)
  const pilot = pilotHa(v, y) > 0
  const by = new Map(st.map(s => [s.key, s]))
  return (
    <div className={cn('flex h-3 gap-px', className)} aria-hidden="true">
      {STAGES.map(s => {
        const cell = by.get(s.key)
        const isPilot = s.key === 'farm' && !cell && pilot
        const c = STAGE_VAR[s.key]
        const planned = (cell?.planned ?? y > CUR) || !!cell?.pre
        if (!cell && !isPilot) return <span key={s.key} className="min-w-0 flex-1 rounded-[2px] bg-surface-2" />
        if (isPilot) return <span key={s.key} className="min-w-0 flex-1 rounded-[2px] border border-dashed" style={{ borderColor: c }} />
        return <span key={s.key} className="min-w-0 flex-1 rounded-[2px]" style={{ background: planned ? stripeBg(c) : c }} />
      })}
    </div>
  )
}

function rowNote(v: Variety) {
  const lag = lagOf(v)
  if (v.preMultiplication) return { main: `등록→농가 ${lag}년(사전 증식)`, sub: `표준이면 ${stdFarmYear(v)}` }
  return { main: `등록→농가 ${lag}년`, sub: `${regYearOf(v)} → ${firstFarmYear(v)}` }
}

/** 390: 격자 대신 품종별 현재 단계 · 농가 도달 연도 목록 */
function StageList() {
  return (
    <ul className="flex flex-col" aria-label={`품종별 ${CUR}년 증식 단계와 농가 도달 연도`}>
      {VARIETIES.map(v => {
        const note = rowNote(v)
        const pre = v.preMultiplication
        return (
          <li key={v.id} className="border-b border-border/70 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[13px] font-semibold text-text">{v.name}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-text">농가 {firstFarmYear(v) ?? '—'}</span>
            </div>
            <StageStrip v={v} y={CUR} className="mt-1.5" />
            <p className="mt-1.5 break-keep text-xs tabular-nums text-text">
              {CUR} {currentStage(v) || '단계 없음'}
              {pre && ' · 사전 증식(계획)'}
            </p>
            <p className="mt-0.5 break-keep text-xs tabular-nums text-muted">
              {pre
                ? `출원 ${v.filedAt} · 재배심사 ${REVIEW_YEARS[0]}~${REVIEW_YEARS[1]} · 등록 예정 ${regYearOf(v)} · ${note.main}, ${note.sub}`
                : `${v.line} · 등록 ${v.regMonth ?? v.reg} · ${note.main}`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function Grid() {
  return (
    // 표가 아닌 넓은 격자처럼 가로로 넘치는 영역: 공통 ScrollRegion(실제로 넘칠 때만 안내·페이드).
    // 스크롤 컨테이너에 relative — 칸 안 sr-only(absolute)가 컨테이너 밖 기준으로 배치돼 페이지 폭을 늘리지 않게
    <ScrollRegion label="증식 단계 타임라인(가로 스크롤)" hint={`옆으로 밀어 ${TIMELINE_YEARS[TIMELINE_YEARS.length - 1]}년까지 보기 →`} className="relative rounded-md border border-border">
      {/* table-fixed: 연도 칸 폭을 같게 해 띠 길이로 연도를 비교한다(자동 폭이면 긴 문구가 있는 칸만 넓어졌다) */}
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-xs tabular-nums">
        <caption className="sr-only">
          품종별 연도별 종자 증식 단계. 기본식물 → 원원종 → 원종 → 보급종 생산 → 농가 재배, 단계마다 1년. 2027년 이후는 계획.
        </caption>
        <thead>
          <tr className="border-b border-text/25 text-muted">
            <th scope="col" className="sticky left-0 z-10 w-[148px] bg-surface px-2 py-1.5 text-left font-medium">
              품종(계통)
            </th>
            {TIMELINE_YEARS.map(y => (
              <th
                key={y}
                scope="col"
                className={cn('px-1 py-1.5 text-center font-medium', y === CUR && 'w-[124px] bg-surface-2 font-semibold text-text', y > CUR && 'italic')}
              >
                {y}
                {y === CUR && <span className="block text-[11px] font-semibold not-italic text-text">기준일</span>}
                {y === CUR + 1 && <span className="block text-[11px] font-medium text-muted">계획 →</span>}
              </th>
            ))}
            <th scope="col" className="w-[124px] px-2 py-1.5 text-left font-medium">
              등록 → 농가
            </th>
          </tr>
        </thead>
        <tbody>
          {VARIETIES.map(v => {
            const note = rowNote(v)
            const reg = regYearOf(v)
            return (
              <tr key={v.id} className="border-b border-border/70 last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-normal">
                  <span className="block font-semibold text-text">{v.name}</span>
                  <span className="block text-[11px] text-muted">
                    {v.line} · {v.reg ? `등록 ${v.regMonth ?? v.reg}` : `출원 ${v.filedAt}`}
                  </span>
                </th>
                {TIMELINE_YEARS.map(y => {
                  const parts = cellTitle(v, y)
                  const st = stageOf(v, y)
                  const has = st.length > 0 || pilotHa(v, y) > 0
                  const isReg = reg === y
                  const isFiled = v.filedAt?.startsWith(String(y))
                  const isReview = v.preMultiplication && (REVIEW_YEARS as readonly number[]).includes(y)
                  const pre = st.some(s => s.pre)
                  const tags: string[] = []
                  if (isReg) tags.push(v.reg ? '◆ 등록' : '◇ 등록 예정')
                  if (isFiled) tags.push('○ 출원')
                  if (isReview) tags.push('재배심사')
                  if (pre) tags.push('사전 증식(계획)')
                  else if (pilotHa(v, y) > 0 && y !== CUR) tags.push(`시범 ${ha(pilotHa(v, y))}`)
                  const sr = `${v.name} ${y}: ${[...tags, ...parts].join(', ') || '단계 없음'}`
                  return (
                    <td key={y} className={cn('px-1 py-1.5 align-middle', y === CUR && 'bg-surface-2/70')} title={parts.join('\n') || undefined}>
                      <span className="sr-only">{sr}</span>
                      {has && <StageStrip v={v} y={y} />}
                      {y === CUR && has && (
                        <span aria-hidden="true" className="mt-1 block break-keep text-[11px] font-semibold leading-tight text-text">
                          {currentStage(v)}
                        </span>
                      )}
                      {tags.length > 0 && (
                        <span aria-hidden="true" className={cn('mt-0.5 block break-keep text-center text-[11px] leading-tight', isReg ? 'font-bold text-text' : pre ? 'font-semibold text-text' : 'text-muted')}>
                          {tags.join(' · ')}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-1 align-middle">
                  <span className={cn('block text-text', v.preMultiplication ? 'font-bold' : 'font-semibold')}>{note.main}</span>
                  <span className="block text-[11px] text-muted">{note.sub}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollRegion>
  )
}

/** C. 증식 단계 타임라인 — 품종 11행 × 2019~2030(390은 품종별 목록) */
export function StageTimeline({ narrow = false }: { narrow?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {narrow ? <StageList /> : <Grid />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <span>띠 왼쪽부터</span>
        {STAGES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: STAGE_VAR[s.key] }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[2px] border border-dashed" style={{ borderColor: STAGE_VAR.farm }} />
          시범 재배(원종 일부)
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: stripeBg(PLAN_SWATCH) }} />
          계획(빗금)
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-muted">
        <li>
          표준 일정(등록 연도 Y): 기본식물 Y−1 · 원원종 Y · 원종 Y+1 · 보급종 생산 Y+2 · 농가 공급 Y+3(봄) — 등록 직후 재배 면적은 0, 첫 농가 재배는 등록 {STD_LAG}년 뒤.
        </li>
        <li>
          {josa(BYEOLHARANG.name, '는은')} 재배심사({REVIEW_YEARS[0]}~{REVIEW_YEARS[1]}) 중 원원종·원종을 미리 증식해 등록 예정 {regYearOf(BYEOLHARANG)} 직후 보급종을 생산, {firstFarmYear(BYEOLHARANG)} 농가 공급이 목표(표준이면{' '}
          {stdFarmYear(BYEOLHARANG)}). 등록 전 종자는 판매·분양하지 않습니다.
        </li>
        <li>
          계획 보급종이 {LAST_P3_YEAR}년산까지만 있어 역산할 값이 없으므로 기본식물은 {EMPTY_FROM.breeder}, 원원종은 {EMPTY_FROM.prebasic}, 원종은 {EMPTY_FROM.basic}년부터 칸이 비어 있습니다.
        </li>
        <li>
          심사 중 {UNDER_REVIEW.length}품종({UNDER_REVIEW.join('·')})은 증식 계획 미수립. 온새미로는 MET 대비 품종(2025~2026)이지만 농가 보급은 {firstFarmYear(VARIETIES.find(v => v.name === '온새미로')!)}년부터입니다(대비 품종 지정과 보급은 별개).
        </li>
      </ul>
    </div>
  )
}
