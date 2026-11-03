export const meta = {
  name: 'breeding-template-build',
  description: '디지털육종 UI/UX 템플릿을 템플릿별 명세→구현→검증→수정 파이프라인으로 만든다',
  phases: [
    { title: '명세', detail: '도메인 분석가가 지표 정의·목업 데이터 규칙·수용 기준을 쓴다' },
    { title: '구현', detail: '템플릿 빌더가 디자인 시스템 위에 템플릿을 구현한다' },
    { title: '검증', detail: 'UI QA와 도메인 검토를 병렬로 수행한다' },
    { title: '수정', detail: 'blocker·major 이슈가 남으면 빌더가 고치고 다시 검증한다' },
    { title: '명세 동기화', detail: '분석가가 최종 코드·검토 결과에 맞춰 명세를 고친다' },
    { title: '동기화 반영', detail: '명세가 맞고 코드가 틀린 항목(codeIssues)을 빌더가 고치고 자체 검증한다' },
  ],
}

// args: { now: 'YYYY-MM-DD', templates: [{ slug, category, title, brief, feedback? }], maxFixRounds?: number, skipSpec?: boolean }

const SPEC = {
  type: 'object',
  required: ['slug', 'specPath', 'organism', 'metrics', 'acceptance'],
  properties: {
    slug: { type: 'string' },
    specPath: { type: 'string' },
    organism: { type: 'string' },
    metrics: { type: 'array', items: { type: 'string' } },
    acceptance: { type: 'array', items: { type: 'string' } },
  },
}

const BUILD = {
  type: 'object',
  required: ['slug', 'files', 'sharedCandidates', 'notes'],
  properties: {
    slug: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    sharedCandidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'reason'],
        properties: { name: { type: 'string' }, reason: { type: 'string' }, path: { type: 'string' } },
      },
    },
    notes: { type: 'string' },
  },
}

const ISSUES = {
  type: 'object',
  required: ['verdict', 'issues', 'reportPath'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    reportPath: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'area', 'description'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          area: { type: 'string' },
          description: { type: 'string' },
          file: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

const SYNC = {
  type: 'object',
  required: ['slug', 'specUpdated', 'changes', 'codeIssues', 'deferred'],
  properties: {
    slug: { type: 'string' },
    specUpdated: { type: 'boolean' },
    changes: { type: 'array', items: { type: 'string' } },
    codeIssues: { type: 'array', items: { type: 'string' } },
    // 남은 minor 가운데 명세 수정(changes)도 codeIssues도 아닌 것. 이것만 배치 뒤에 남는 이월 항목이다.
    deferred: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description', 'kind'],
        properties: {
          description: { type: 'string' },
          kind: { type: 'string', enum: ['baseline', 'later', 'wontfix'] },
          reason: { type: 'string' },
          file: { type: 'string' },
        },
      },
    },
  },
}

const templates = args.templates ?? []
const maxFix = args.maxFixRounds ?? 2
if (!templates.length) return { error: '템플릿 목록(args.templates)이 비어 있습니다.' }

const dirOf = t => `src/templates/${t.category}/${t.slug}/`
const specPathOf = t => `docs/specs/${t.slug}.md`
const isBlocking = i => i.severity === 'blocker' || i.severity === 'major'

function specPrompt(t) {
  return [
    `명세 모드로 작업하라. Skill 도구로 breeding-metrics 스킬을 불러와 따른다.`,
    `템플릿 브리프: ${JSON.stringify({ slug: t.slug, category: t.category, title: t.title, brief: t.brief })}`,
    t.feedback ? `사용자 피드백(반영 필수): ${t.feedback}` : '',
    `기존 ${specPathOf(t)}가 있으면 읽고 필요한 부분만 고친다. 없으면 스킬의 「명세 문서 형식」대로 새로 쓴다.`,
    `스킬의 「명세 검산」을 반드시 수행하라: 생성 규칙을 Node 스크립트로 실행해 수용 기준·지표 표·기본 상태 화면의 숫자를 실행값으로 적고 「검산 기록」 절에 남긴다.`,
    `breeding-metrics의 references/program-baseline.md를 읽고, 이 템플릿이 다루는 사실은 그 기준값을 따른다(다른 템플릿과 숫자가 어긋나지 않게).`,
    `기준일: ${args.now}. 결과 파일 경로를 specPath로, 핵심 지표 이름 목록과 수용 기준 문장 목록을 함께 반환하라.`,
  ].filter(Boolean).join('\n')
}

function buildPrompt(t, spec) {
  return [
    `Skill 도구로 template-authoring 스킬을 불러와 따른다.`,
    `명세 ${spec.specPath}를 읽고 ${dirOf(t)}에 템플릿을 구현하라. 폴더가 없으면 스캐폴드 스크립트로 만든다.`,
    `템플릿: ${JSON.stringify({ slug: t.slug, category: t.category, title: t.title })}`,
    t.feedback ? `사용자 피드백(반영 필수): ${t.feedback}` : '',
    `자기 템플릿 폴더 밖의 파일은 고치지 않는다. 다른 빌더가 동시에 작업 중이다.`,
    `완료 전에 typecheck(자기 폴더 오류 0), lint-templates.mjs --slug ${t.slug}(오류 0), check-ssr.mjs --slug ${t.slug}(실패 0 — 다운로드 스타터가 SSR로 불러온다), verify-templates.mjs --slug ${t.slug} --out _workspace/qa(스크린샷은 반드시 이 경로)를 직접 확인하라.`,
  ].filter(Boolean).join('\n')
}

function fixPrompt(t, spec, round, issues, reports) {
  return [
    `Skill 도구로 template-authoring 스킬을 불러와 「8. 수정 요청 처리」를 따른다.`,
    `${dirOf(t)} 템플릿의 검증 결과 아래 이슈가 남았다(수정 회차 ${round}). blocker → major 순으로 고쳐라. 통과한 부분은 건드리지 마라.`,
    `이슈: ${JSON.stringify(issues)}`,
    `상세 보고서: ${reports.join(', ')}. 명세: ${spec.specPath}`,
    `도메인 이슈가 명세 자체의 오류라고 판단되면 고치지 말고 notes에 근거를 적어라.`,
  ].join('\n')
}

function verify(t, spec, round) {
  const ph = round === 0 ? '검증' : '수정'
  return parallel([
    () => agent(
      [
        `Skill 도구로 template-qa 스킬을 불러와 절차 1~5를 모두 수행하라.`,
        `대상: slug=${t.slug}, category=${t.category}, round=${round}. 보고서는 _workspace/03_qa_${t.slug}_r${round}.md`,
        round > 0 ? `이전 회차 보고서 _workspace/03_qa_${t.slug}_r${round - 1}.md의 이슈가 해결됐는지 먼저 확인하라.` : '',
      ].filter(Boolean).join('\n'),
      { agentType: 'ui-qa-inspector', label: `QA:${t.slug}#${round}`, phase: ph, schema: ISSUES },
    ),
    () => agent(
      [
        `검토 모드로 작업하라. Skill 도구로 breeding-metrics 스킬을 불러와 「검토 모드 체크리스트」를 따른다. 코드는 고치지 않는다.`,
        `명세: ${spec.specPath}, 템플릿: ${dirOf(t)} (index.tsx, data.ts와 하위 파일을 모두 읽는다).`,
        `스크린샷이 _workspace/qa/${t.slug}/에 있으면 1440-light.png를 열어 화면의 숫자도 확인하라(QA와 동시에 실행되므로 없을 수 있다).`,
        `보고서는 _workspace/03_domain_${t.slug}_r${round}.md`,
        round > 0 ? `이전 회차 보고서 _workspace/03_domain_${t.slug}_r${round - 1}.md의 지적이 해결됐는지 먼저 확인하라.` : '',
      ].filter(Boolean).join('\n'),
      { agentType: 'breeding-domain-analyst', label: `도메인:${t.slug}#${round}`, phase: ph, schema: ISSUES },
    ),
  ]).then(rs => {
    const done = rs.filter(Boolean)
    if (done.length < rs.length) log(`${t.slug} 회차 ${round}: 검증자 ${rs.length - done.length}명이 결과를 반환하지 못했습니다.`)
    return {
      verifiers: done.length,
      issues: done.flatMap(r => r.issues ?? []),
      reports: done.map(r => r.reportPath).filter(Boolean),
      verdicts: done.map(r => r.verdict),
    }
  })
}

const results = await pipeline(
  templates,
  // 1. 명세
  async t => {
    if (args.skipSpec) return { t, spec: { slug: t.slug, specPath: specPathOf(t), organism: '', metrics: [], acceptance: [] } }
    const spec = await agent(specPrompt(t), { agentType: 'breeding-domain-analyst', label: `명세:${t.slug}`, phase: '명세', schema: SPEC })
    return spec ? { t, spec } : { t, failed: '명세' }
  },
  // 2. 구현
  async x => {
    if (x.failed) return x
    const build = await agent(buildPrompt(x.t, x.spec), { agentType: 'template-builder', label: `구현:${x.t.slug}`, phase: '구현', schema: BUILD })
    return build ? { ...x, builds: [build] } : { ...x, failed: '구현' }
  },
  // 3. 검증 → 4. 수정 반복
  async x => {
    if (x.failed) return x
    let round = 0
    let v = await verify(x.t, x.spec, round)
    let open = v.issues.filter(isBlocking)
    // 검증자가 누락돼 이슈가 0건이면 수정할 대상이 없으므로 반복하지 않고 아래에서 unverified로 표시한다
    while (open.length && round < maxFix) {
      round++
      const fix = await agent(fixPrompt(x.t, x.spec, round, open, v.reports), {
        agentType: 'template-builder', label: `수정:${x.t.slug}#${round}`, phase: '수정', schema: BUILD,
      })
      if (fix) x.builds.push(fix)
      else log(`${x.t.slug} 수정 회차 ${round}: 빌더가 결과를 반환하지 못했습니다.`)
      v = await verify(x.t, x.spec, round)
      open = v.issues.filter(isBlocking)
    }
    const status = v.verifiers < 2 ? 'unverified' : open.length ? 'fail' : 'pass'
    return { ...x, rounds: round, status, final: v, open }
  },
  // 5. 명세 동기화 — 수정 단계에서 바뀐 상수·명세 오류 지적을 명세에 되돌려 다음 재생성 때 같은 오류가 되살아나지 않게 한다
  async x => {
    if (x.failed || args.skipSpec) return x
    const sync = await agent(
      [
        `동기화 모드로 작업하라. Skill 도구로 breeding-metrics 스킬을 불러와 「명세 동기화」를 따른다. 명세 파일만 고치고 코드는 고치지 않는다.`,
        `명세: ${x.spec.specPath}, 템플릿: ${dirOf(x.t)}`,
        `빌더 notes: ${JSON.stringify((x.builds ?? []).map(b => b.notes).filter(Boolean))}`,
        `최종 검토 보고서: ${(x.final?.reports ?? []).join(', ')}. 남은 이슈: ${JSON.stringify((x.final?.issues ?? []).map(i => ({ severity: i.severity, area: i.area, description: i.description, file: i.file })))}`,
        `남은 이슈는 하나도 빠짐없이 셋 중 하나로 분류하라: 명세를 고쳐 닫음(changes), 코드를 고쳐야 함(codeIssues — 다음 단계에서 빌더가 고친다), 이번에 안 고침(deferred — kind: baseline=공유 기준값이라 backlog에 올림, later=정리 회차로 미룸, wontfix=고치지 않기로 함, reason 필수). 이미 코드에 반영돼 있으면 어느 쪽에도 넣지 말고 changes에 "이미 반영: …"으로 적는다.`,
        `기준일: ${args.now}`,
      ].join('\n'),
      { agentType: 'breeding-domain-analyst', label: `명세동기화:${x.t.slug}`, phase: '명세 동기화', schema: SYNC },
    )
    if (!sync) log(`${x.t.slug}: 명세 동기화 결과가 없습니다. 명세와 코드가 어긋나 있을 수 있습니다.`)
    return { ...x, sync }
  },
  // 6. 동기화 반영 — 회고 2(배치 5~8): 8개 템플릿 모두 codeIssues 3~8건이 나와 메인이 매번 빠른 경로 빌더를 손으로 돌렸다.
  //    동기화된 명세가 기준이므로 재검토 없이 빌더 자체 검증(lint·verify·DEV 검산)으로 닫는다.
  async x => {
    const issues = x.sync?.codeIssues ?? []
    if (x.failed || !issues.length) return x
    const fix = await agent(
      [
        `Skill 도구로 template-authoring 스킬을 불러와 「8. 수정 요청 처리」를 따른다.`,
        `${dirOf(x.t)} 템플릿: 분석가가 명세를 최종 코드에 맞춰 동기화한 뒤, 명세가 맞고 코드가 틀린 항목을 아래에 남겼다. 동기화된 명세 ${x.spec.specPath}(끝의 「변경 이력」)를 기준으로 모두 고쳐라.`,
        `항목: ${JSON.stringify(issues)}`,
        `자기 템플릿 폴더 밖은 고치지 않는다. 공통 모듈(디자인 시스템·차트·lib) 변경이 필요한 항목은 고치지 말고 notes에 '[공통]'으로 적어라(메인이 승격 단계에 넘긴다).`,
        `명세 숫자·생성 규칙은 바꾸지 않는다. 화면에 보이는 숫자를 바꿨으면 DEV 검산도 맞춘다.`,
        `완료 전에 typecheck(자기 폴더 오류 0), lint-templates.mjs --slug ${x.t.slug}, check-ssr.mjs --slug ${x.t.slug}(실패 0), verify-templates.mjs --slug ${x.t.slug} --out _workspace/qa(문제 0)를 확인하고, README 변경 이력에 한 줄 남겨라.`,
      ].join('\n'),
      { agentType: 'template-builder', label: `동기화반영:${x.t.slug}`, phase: '동기화 반영', schema: BUILD },
    )
    if (!fix) log(`${x.t.slug}: 동기화 반영 빌더가 결과를 반환하지 못했습니다. codeIssues ${issues.length}건이 남아 있습니다.`)
    return { ...x, codeFix: fix, builds: fix ? [...x.builds, fix] : x.builds }
  },
)

const ok = results.filter(Boolean)
if (ok.length < templates.length) log(`템플릿 ${templates.length}개 중 ${templates.length - ok.length}개는 결과가 없습니다.`)

const summary = ok.map(x => ({
  slug: x.t.slug,
  category: x.t.category,
  status: x.failed ? `failed:${x.failed}` : x.status,
  rounds: x.rounds ?? 0,
  openIssues: x.open ?? [],
  // 회고 3: 마지막 검증의 minor를 그대로 넘기면 동기화 반영에서 이미 고친 것까지 이월 목록에 남는다(정리 회차 3 계획 항목의 절반이 이미 반영돼 있었음).
  // 동기화가 있으면 그 분류의 deferred만 이월로 본다. 동기화가 없으면 마지막 검증의 minor를 그대로 둔다.
  deferredMinors: x.sync ? (x.sync.deferred ?? []) : (x.final?.issues ?? []).filter(i => i.severity === 'minor').map(i => ({ description: i.description, kind: 'later', file: i.file })),
  minorCountAtVerify: (x.final?.issues ?? []).filter(i => i.severity === 'minor').length,
  reports: x.final?.reports ?? [],
  specPath: x.spec?.specPath ?? null,
  notes: (x.builds ?? []).map(b => b.notes).filter(Boolean),
  specSync: x.sync ? { updated: x.sync.specUpdated, changes: x.sync.changes, codeIssues: x.sync.codeIssues } : null,
  codeFix: x.sync?.codeIssues?.length ? (x.codeFix ? { done: true, notes: x.codeFix.notes } : { done: false }) : null,
}))
const sharedCandidates = ok.flatMap(x => (x.builds ?? []).flatMap(b => (b.sharedCandidates ?? []).map(c => ({ ...c, from: x.t.slug }))))
const missing = templates.filter(t => !ok.some(x => x.t.slug === t.slug)).map(t => t.slug)

log(`완료: pass ${summary.filter(s => s.status === 'pass').length} · fail ${summary.filter(s => s.status === 'fail').length} · 기타 ${summary.filter(s => s.status !== 'pass' && s.status !== 'fail').length}`)
return { now: args.now, summary, sharedCandidates, missing }
