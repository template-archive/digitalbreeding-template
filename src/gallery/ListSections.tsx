import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

const QUESTIONS = [
  { question: '소스가 없어도 프로젝트에 가져올 수 있나요?', answer: '상세 화면의 코드 받기로 실행 가능한 스타터 ZIP을 내려받으세요. 템플릿과 공통 컴포넌트, 패키지 설정이 포함됩니다. Node.js 환경에서 압축을 풀고 npm ci, npm run dev 순서로 실행합니다. 적용 가이드도 함께 제공됩니다.' },
  { question: '실제 데이터는 어떻게 연결하나요?', answer: '모든 템플릿에서 목업 데이터와 참고 명세, 적용 가이드를 받을 수 있습니다. 외부 파일 미리보기는 현재 육종 프로그램 KPI 개요의 연간 개량량 지표만 지원하며, 나머지는 프로젝트에 맞는 데이터 어댑터를 구현해야 합니다.' },
  { question: '내 데이터는 어디에 저장되나요?', answer: '파일 미리보기는 브라우저 메모리에서만 처리하며 서버로 전송하거나 저장하지 않습니다. 새로고침하면 사라집니다. 공동 저장·승인 등 업무 기능은 목업이며 실제 운영에는 별도의 API와 권한 설정이 필요합니다.' },
  { question: '화면만 따로 확인할 수 있나요?', answer: '상세 화면에서 임베드로 열기를 누르면 메뉴 없이 템플릿만 새 탭에 표시됩니다. 주소에 ?theme=light 또는 ?theme=dark를 사용해 테마를 고정할 수 있습니다.' },
  { question: '작은 화면과 인쇄 결과는 어떻게 확인하나요?', answer: '상세 화면의 미리보기 폭으로 데스크톱과 모바일 구성을 비교합니다. 인쇄 버튼이 있는 템플릿은 라이트 테마로 인쇄할 수 있습니다.' },
]

export function UsageQuestions() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section aria-labelledby="usage-title" className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
      <div>
        <h2 id="usage-title" className="text-xl font-semibold tracking-tight text-text">템플릿 사용 안내</h2>
        <p className="mt-3 max-w-sm break-keep text-sm leading-relaxed text-muted">화면을 고른 뒤 코드·데이터·적용 가이드를 내려받아 프로젝트에 연결하세요.</p>
      </div>
      <div>
        {QUESTIONS.map((item, index) => (
          <div key={item.question} className="border-b border-border first:border-t">
            <h3>
              <button type="button" aria-expanded={open === index} aria-controls={`usage-answer-${index}`} onClick={() => setOpen(open === index ? null : index)} className="flex min-h-14 w-full items-center justify-between gap-5 rounded-sm py-4 text-left text-sm font-medium text-text hover:text-muted">
                {item.question}
                {open === index ? <Minus size={16} aria-hidden="true" className="shrink-0" /> : <Plus size={16} aria-hidden="true" className="shrink-0" />}
              </button>
            </h3>
            <div id={`usage-answer-${index}`} hidden={open !== index}>
              <p className="max-w-prose break-keep pb-5 text-sm leading-7 text-muted">{item.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
