export const MAX_FILE_BYTES = 1024 * 1024
export const MAX_ROWS = 200

export const PROGRAM_FIELDS = [
  { key: 'year', label: '연도', unit: '년', minimum: 1900, maximum: 2200 },
  { key: 'selectionIntensity', label: '선발 강도 i', unit: '무단위', minimum: 0 },
  { key: 'accuracy', label: '선발 정확도 r', unit: '0–1', minimum: 0, maximum: 1 },
  { key: 'geneticSd', label: '상가적 유전 표준편차 σA', unit: 'kg/10a', minimum: 0 },
  { key: 'generationInterval', label: '세대 간격 L', unit: '년', minimum: 0, exclusive: true },
  { key: 'targetGainPct', label: '연간 개량량 목표', unit: '%/년', minimum: 0, exclusive: true },
] as const

export type ProgramField = (typeof PROGRAM_FIELDS)[number]['key']
export type ProgramRow = Record<ProgramField, number>
export interface ProgramDataset {
  projectName: string
  baselineYield: number
  rows: ProgramRow[]
}
export interface CsvTable { headers: string[]; rows: string[][] }
export type ColumnMapping = Record<ProgramField, string>

export function validateProgramData(input: unknown): ProgramDataset {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON은 projectName, baselineYield, rows를 가진 객체여야 합니다.')
  const value = input as Record<string, unknown>
  const errors: string[] = []
  if (typeof value.projectName !== 'string' || !value.projectName.trim() || value.projectName.length > 100) errors.push('프로젝트 이름은 1–100자여야 합니다.')
  if (typeof value.baselineYield !== 'number' || !Number.isFinite(value.baselineYield) || value.baselineYield <= 0) errors.push('기준 수량은 0보다 큰 유한한 숫자여야 합니다(kg/10a).')
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > MAX_ROWS) throw new Error([...errors, `데이터는 1–${MAX_ROWS}행이어야 합니다.`].join('\n'))
  const years = new Set<number>()
  const rows = value.rows.map((row: unknown, index: number) => {
    const output = {} as ProgramRow
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${index + 1}행: 각 행은 객체여야 합니다.`)
      return output
    }
    for (const field of PROGRAM_FIELDS) {
      const number = (row as Record<string, unknown>)[field.key]
      const exclusive = 'exclusive' in field && field.exclusive
      const maximum = 'maximum' in field ? field.maximum : Infinity
      if (typeof number !== 'number' || !Number.isFinite(number) || (exclusive ? number <= field.minimum : number < field.minimum) || number > maximum || (field.key === 'year' && !Number.isInteger(number))) {
        errors.push(`${index + 1}행: ${field.label} 값을 확인하세요(${exclusive ? '>' : '≥'} ${field.minimum}${Number.isFinite(maximum) ? `, ≤ ${maximum}` : ''} ${field.unit}).`)
      } else output[field.key] = number
    }
    if (output.year !== undefined) {
      if (years.has(output.year)) errors.push(`${index + 1}행: ${output.year}년이 중복되었습니다.`)
      years.add(output.year)
    }
    const gain = output.selectionIntensity * output.accuracy * output.geneticSd / output.generationInterval
    const gainPct = gain / (value.baselineYield as number) * 100
    if (!Number.isFinite(gain) || !Number.isFinite(gainPct) || !Number.isFinite(gainPct / output.targetGainPct * 100)) errors.push(`${index + 1}행: 계산 결과가 숫자 범위를 벗어났습니다.`)
    return output
  })
  if (errors.length) throw new Error(errors.slice(0, 20).join('\n'))
  return { projectName: (value.projectName as string).trim(), baselineYield: value.baselineYield as number, rows: rows.sort((first, second) => first.year - second.year) }
}

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  const finishRecord = () => {
    record.push(cell)
    if (record.some(value => value.trim() !== '')) records.push(record)
    record = []
    cell = ''
    closedQuote = false
    if (records.length > MAX_ROWS + 1) throw new Error(`CSV는 최대 ${MAX_ROWS}행까지 지원합니다.`)
  }
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { cell += '"'; index += 1 }
        else { quoted = false; closedQuote = true }
      } else cell += character
    } else if (character === ',') {
      record.push(cell)
      cell = ''
      closedQuote = false
    } else if (character === '\n' || character === '\r') {
      finishRecord()
      if (character === '\r' && source[index + 1] === '\n') index += 1
    } else if (character === '"' && cell === '' && !closedQuote) quoted = true
    else if (character === '"' || (closedQuote && character.trim())) throw new Error('CSV의 따옴표 형식이 올바르지 않습니다.')
    else if (!closedQuote) cell += character
  }
  if (quoted) throw new Error('CSV의 닫는 따옴표가 없습니다.')
  if (cell || record.length || closedQuote) finishRecord()
  if (records.length < 2) throw new Error('CSV에는 머리글과 최소 1행의 데이터가 필요합니다.')
  const headers = records[0]!.map(header => header.trim())
  if (headers.length > 100) throw new Error('CSV는 최대 100열까지 지원합니다.')
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('CSV 열 이름은 비어 있거나 중복될 수 없습니다.')
  const rows = records.slice(1)
  if (rows.some(row => row.length !== headers.length)) throw new Error('CSV의 열 개수가 머리글과 일치하지 않습니다.')
  return { headers, rows }
}

export function mapProgramCsv(table: CsvTable, mapping: ColumnMapping, projectName: string, baselineYield: number): ProgramDataset {
  const columns = PROGRAM_FIELDS.map(field => table.headers.indexOf(mapping[field.key]))
  if (columns.some(index => index < 0)) throw new Error('모든 필수 항목에 CSV 열을 연결하세요.')
  if (new Set(columns).size !== columns.length) throw new Error('하나의 CSV 열을 여러 필수 항목에 중복 연결할 수 없습니다.')
  const rows = table.rows.map((row, index) => Object.fromEntries(PROGRAM_FIELDS.map((field, fieldIndex) => {
    const text = row[columns[fieldIndex]!]!.trim()
    if (!text || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new Error(`${index + 1}행: ${field.label}에는 숫자를 입력하세요. 빈칸·NA는 지원하지 않습니다.`)
    return [field.key, Number(text)]
  })))
  return validateProgramData({ projectName, baselineYield, rows })
}

export const programSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '육종 프로그램 연간 개량량 데이터',
  type: 'object',
  required: ['projectName', 'baselineYield', 'rows'],
  properties: {
    projectName: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    baselineYield: { type: 'number', exclusiveMinimum: 0, description: '기준 수량 μ (kg/10a)' },
    rows: {
      type: 'array', minItems: 1, maxItems: MAX_ROWS,
      items: {
        type: 'object', required: PROGRAM_FIELDS.map(field => field.key),
        properties: Object.fromEntries(PROGRAM_FIELDS.map(field => [field.key, {
          type: field.key === 'year' ? 'integer' : 'number',
          description: `${field.label} (${field.unit})`,
          ...('exclusive' in field ? { exclusiveMinimum: field.minimum } : { minimum: field.minimum }),
          ...('maximum' in field ? { maximum: field.maximum } : {}),
        }])),
      },
    },
  },
}
