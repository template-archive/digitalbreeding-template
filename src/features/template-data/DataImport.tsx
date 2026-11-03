import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/design-system'
import { MAX_FILE_BYTES, PROGRAM_FIELDS, mapProgramCsv, parseCsv, validateProgramData, type ColumnMapping, type CsvTable, type ProgramDataset } from './contract'

export function DataImport({ onApply }: { onApply: (data: ProgramDataset | null) => void }) {
  const id = useId()
  const sequence = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [table, setTable] = useState<CsvTable | null>(null)
  const [json, setJson] = useState<ProgramDataset | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping)
  const [projectName, setProjectName] = useState('내 육종 프로젝트')
  const [baseline, setBaseline] = useState('560')
  const [filename, setFilename] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)
  useEffect(() => () => { sequence.current += 1 }, [])

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const request = ++sequence.current
    setTable(null)
    setJson(null)
    setError('')
    setApplied(false)
    setFilename(file.name)
    onApply(null)
    setBusy(true)
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('파일은 1MB 이하여야 합니다.')
      if (!/\.(json|csv)$/i.test(file.name)) throw new Error('CSV 또는 JSON 파일을 선택하세요.')
      const buffer = await file.arrayBuffer()
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
      catch { throw new Error('UTF-8 인코딩의 CSV·JSON 파일로 저장한 뒤 다시 선택하세요.') }
      if (sequence.current !== request) return
      if (/\.json$/i.test(file.name)) {
        setJson(validateProgramData(JSON.parse(text.replace(/^\uFEFF/, ''))))
      } else {
        const parsed = parseCsv(text)
        setTable(parsed)
        setMapping(Object.fromEntries(PROGRAM_FIELDS.map(field => [field.key, parsed.headers.find(header => header === field.key || header === field.label) ?? ''])) as ColumnMapping)
      }
    } catch (reason) {
      if (sequence.current === request) setError(reason instanceof SyntaxError ? 'JSON 문법이 올바르지 않습니다.' : reason instanceof Error ? reason.message : '파일을 읽지 못했습니다.')
    } finally {
      if (sequence.current === request) setBusy(false)
    }
  }

  const apply = () => {
    try {
      const data = json ?? (table ? mapProgramCsv(table, mapping, projectName, Number(baseline)) : null)
      if (!data) return
      onApply(data)
      setApplied(true)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '입력값을 확인하세요.') }
  }
  const reset = () => {
    sequence.current += 1
    setTable(null)
    setJson(null)
    setFilename('')
    setError('')
    setApplied(false)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
    onApply(null)
  }
  const editDraft = () => {
    setApplied(false)
    setError('')
    onApply(null)
  }

  return (
    <details className="mt-4 rounded-md border border-border bg-surface px-4" data-print-hide="">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-text">내 데이터로 미리보기</summary>
      <div className="space-y-4 pb-4">
        <p id={`${id}-help`} className="max-w-prose break-keep text-[13px] leading-relaxed text-muted">연간 개량량 KPI와 추세 차트에 연결합니다. CSV·JSON, 최대 1MB·200행(CSV 100열). CSV는 UTF-8 쉼표 구분 형식으로 준비하고, 수량은 kg/10a·정확도는 0–1로 입력하세요. 변환·단위 환산은 자동으로 하지 않습니다. 파일은 이 브라우저 메모리에서만 처리하며 새로고침하면 사라집니다.</p>
        <label className="block text-[13px] font-medium text-text">
          데이터 파일
          <input ref={inputRef} type="file" accept=".csv,.json" aria-describedby={`${id}-help`} onChange={readFile} className="mt-2 block min-h-11 w-full rounded-md border border-border bg-bg p-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-surface file:px-3 file:py-1 file:text-text" />
        </label>
        {table && (
          <div className="space-y-4">
            <p className="text-sm text-text">{table.rows.length}행을 읽었습니다. 원본 열을 아래 항목에 연결하세요.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[13px] text-muted">프로젝트 이름<input value={projectName} maxLength={100} onChange={event => { editDraft(); setProjectName(event.target.value) }} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text" /></label>
              <label className="text-[13px] text-muted">기준 수량 μ (kg/10a)<input type="number" min="0" step="any" value={baseline} onChange={event => { editDraft(); setBaseline(event.target.value) }} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text" /></label>
              {PROGRAM_FIELDS.map(field => (
                <div key={field.key}>
                  <label htmlFor={`${id}-${field.key}`} className="text-[13px] text-muted">{field.label} ({field.unit})</label>
                  <select
                    id={`${id}-${field.key}`}
                    value={mapping[field.key] ?? ''}
                    onChange={event => { editDraft(); setMapping(previous => ({ ...previous, [field.key]: event.target.value })) }}
                    className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text"
                  >
                    <option value="">열 선택</option>
                    {table.headers.map(header => <option key={header} value={header}>{header}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        {json && <p className="text-sm text-text">{json.projectName} · {json.rows.length}개 연도 · 기준 수량 {json.baselineYield} kg/10a. JSON 필드 검증을 통과했습니다.</p>}
        {error && <p role="alert" className="whitespace-pre-line break-keep rounded-md border border-negative/30 p-3 text-[13px] leading-relaxed text-negative">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={apply} disabled={busy || (!table && !json)}>데이터 적용</Button>
          <Button onClick={reset}>목업으로 되돌리기</Button>
          <p role="status" className="break-all text-[13px] text-muted">{busy ? '파일 읽는 중…' : applied ? `${filename} 적용됨 · 서버 저장 안 됨` : filename ? `${filename} · 아직 적용되지 않았습니다` : '기본 목업 데이터를 표시합니다'}</p>
        </div>
      </div>
    </details>
  )
}
