import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { listPromoteSources, isDeliverableFile } from './promote-outputs.js'

test('isDeliverableFile rejects live and temps', () => {
  assert.equal(isDeliverableFile('live-preview.png'), false)
  assert.equal(isDeliverableFile('a.xlsx.tmp'), false)
  assert.equal(isDeliverableFile('report.xlsx'), true)
})

test('listPromoteSources: downloads + manifest only; skips failure and 页面采集', () => {
  const root = mkdtempSync(join(tmpdir(), 'webclaw-promote-'))
  try {
    mkdirSync(join(root, 'downloads'))
    mkdirSync(join(root, 'documents'))
    mkdirSync(join(root, 'screenshots'))
    mkdirSync(join(root, 'files'))

    writeFileSync(join(root, 'downloads', '2026-07月报.xls'), Buffer.alloc(16))
    writeFileSync(join(root, 'screenshots', 'step-01-01-failure-step-1.png'), Buffer.alloc(16))
    writeFileSync(join(root, 'documents', '页面采集-表格-step-03.md'), '# empty\n')
    writeFileSync(join(root, 'screenshots', 'step-01-01-manual.png'), Buffer.alloc(16))
    writeFileSync(
      join(root, 'library-manifest.jsonl'),
      `${JSON.stringify({ path: 'screenshots/step-01-01-manual.png', reason: 'screenshot' })}\n`,
    )

    const src = listPromoteSources(root).map((p) => p.replace(/\\/g, '/'))
    assert.ok(src.some((p) => p.endsWith('/downloads/2026-07月报.xls')))
    assert.ok(src.some((p) => p.endsWith('/screenshots/step-01-01-manual.png')))
    assert.ok(!src.some((p) => p.includes('failure')))
    assert.ok(!src.some((p) => p.includes('页面采集')))
    assert.equal(src.length, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
