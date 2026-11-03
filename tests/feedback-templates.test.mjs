import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEEDBACK_TEMPLATES } from '../server/feedback-templates.ts'
import { templateKeys } from '../scripts/sync-feedback-templates.mjs'

// 템플릿을 추가했는데 목록을 갱신하지 않으면 그 템플릿의 코멘트가 모두 404가 된다(사내 허브에서는 누구나 템플릿을 추가한다).
test('피드백 API 템플릿 목록이 src/templates 폴더와 같다', () => {
  assert.deepEqual(
    [...FEEDBACK_TEMPLATES].sort(),
    templateKeys().sort(),
    '목록과 폴더가 다릅니다. npm run sync:feedback-templates를 실행하고 server/feedback-templates.ts를 커밋하세요.',
  )
})
