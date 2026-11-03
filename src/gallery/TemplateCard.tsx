import type { ThemeMode } from '@/design-system/themeMode'
import type { TemplateEntry } from './registry'
import { templateHref } from './router'
import { categoryLabel } from './order'
import { THUMB_SIZE, thumbUrl } from './thumbs'

export function TemplateCard({ template, mode }: { template: TemplateEntry; mode: ThemeMode }) {
  const src = thumbUrl(template.path.category, template.path.slug, mode)
  return (
    <li className="min-w-0">
      <a href={templateHref(template.path.category, template.path.slug)} className="group block h-full rounded-md">
        <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-border bg-surface transition-colors duration-150 group-hover:border-muted">
          {src ? <img src={src} alt="" width={THUMB_SIZE.width} height={THUMB_SIZE.height} loading="lazy" className="absolute inset-0 size-full object-cover object-left-top" /> : <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">{categoryLabel(template.path.category)} 미리보기</span>}
        </div>
        <h3 className="mt-3 break-keep text-sm font-semibold text-text group-hover:underline underline-offset-4">{template.meta.title}</h3>
        <p className="mt-1 line-clamp-2 break-keep text-[13px] leading-relaxed text-muted">{template.meta.description}</p>
      </a>
    </li>
  )
}
