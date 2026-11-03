import { useEffect, useId, useRef, useState } from 'react'
import { Download, FileJson, FileText, X } from 'lucide-react'
import { Button } from '@/design-system'

export function resourceHref(category: string, slug: string, file: string) {
  return `${import.meta.env.BASE_URL}downloads/${encodeURIComponent(category)}/${encodeURIComponent(slug)}/${file}`
}

const LINK = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-text hover:bg-surface-2'

/** Download tools live outside the preview; the native dialog owns focus and Escape. */
export function TemplateResources({ category, slug, title }: { category: string; slug: string; title: string }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const connected = category === 'kpi' && slug === 'program-overview'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    const overflow = document.body.style.overflow
    const gutter = document.documentElement.style.scrollbarGutter
    document.documentElement.style.scrollbarGutter = 'stable'
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = overflow
      document.documentElement.style.scrollbarGutter = gutter
    }
  }, [open])

  return <>
    <Button icon={<Download size={14} aria-hidden="true" />} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      프로젝트에 가져오기
    </Button>
    <dialog ref={dialogRef} aria-labelledby={titleId} className="template-resource-dialog" data-print-hide=""
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); setOpen(false) }}
      onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false)
      }}>
      <header className="template-resource-header">
        <div><h2 id={titleId}>프로젝트에 가져오기</h2><p>{title}</p></div>
        <button autoFocus type="button" aria-label="가져오기 닫기" className="template-resource-close" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="template-resource-body">
        <p className="text-sm leading-relaxed text-muted">템플릿과 공통 컴포넌트, 실행 설정이 포함된 코드 ZIP을 받습니다. 압축을 푼 뒤 적용 가이드에 따라 프로젝트에 연결하세요.</p>
        <a href={resourceHref(category, slug, 'starter.zip')} download={`${category}-${slug}-starter.zip`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-contrast hover:opacity-90"><Download size={16} aria-hidden="true" />코드 ZIP 다운로드</a>
        <section aria-label="데이터와 적용 자료" className="mt-6 border-t border-border pt-4">
          <h3 className="text-[13px] font-semibold text-text">데이터와 적용 자료</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={resourceHref(category, slug, 'sample-data.json')} download={`${slug}-sample.json`} className={LINK}><FileJson size={14} aria-hidden="true" />{connected ? '샘플 JSON' : '목업 JSON'}</a>
            {connected && <a href={resourceHref(category, slug, 'sample-data.csv')} download={`${slug}-sample.csv`} className={LINK}>샘플 CSV</a>}
            <a href={resourceHref(category, slug, 'schema.json')} download={`${slug}-schema.json`} className={LINK}>데이터 명세</a>
            <a href={resourceHref(category, slug, 'guide.md')} download={`${slug}-guide.md`} className={LINK}><FileText size={14} aria-hidden="true" />적용 가이드</a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{connected ? '외부 파일 미리보기는 연간 개량량 KPI·추세 차트에 한해 지원합니다. 단위와 필수 필드는 데이터 명세에서 확인하세요.' : '목업 JSON과 명세는 참고 자료입니다. 실제 데이터 연결은 적용 가이드에 따라 어댑터와 검증을 구현하세요.'}</p>
        </section>
        <p className="mt-5 break-all border-t border-border pt-4 text-xs leading-relaxed text-muted">소스 위치 <code className="font-mono">src/templates/{category}/{slug}</code></p>
      </div>
    </dialog>
  </>
}
