export type TemplateCategory = 'kpi' | 'viz' | 'infographic' | 'workflow'

export interface TemplateMeta {
  /** 폴더 이름과 같아야 함 */
  slug: string
  /** 상위 폴더 이름과 같아야 함 */
  category: TemplateCategory
  /** 한국어 제목 */
  title: string
  /** 한 문장 */
  description: string
  /** 예: ['GWAS', '벼', '맨해튼'] */
  tags: string[]
  /** 예: '벼' */
  organism?: string
  status: 'draft' | 'review' | 'stable'
  /** YYYY-MM-DD */
  updatedAt?: string
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  kpi: 'KPI·지표 대시보드',
  viz: '육종 데이터 시각화',
  infographic: '인포그래픽·리포트',
  workflow: '업무 화면',
}

export const CATEGORIES: TemplateCategory[] = ['kpi', 'viz', 'infographic', 'workflow']
