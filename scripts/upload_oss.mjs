/**
 * Upload webclaw-x Release assets (lite + host zip) to Aliyun OSS.
 *
 * Default public prefix:
 *   https://feixingai-agent.oss-cn-beijing.aliyuncs.com/webclaw-x/v{version}/
 *
 * Credentials (first found wins):
 *   1) WEBCLAW_OSS_CONFIG  — path to JSON {region,bucket,accessKeyId,accessKeySecret,publicBaseUrl}
 *   2) <repo>/tools/oss.local.json
 *   3) D:/tools/harness-apps/fengxing-desktop/tools/oss.local.json
 *
 * Usage:
 *   node scripts/upload_oss.mjs --version 0.2.1 --dir <asset-dir>
 *
 * Expected files in --dir (upload what exists):
 *   webclaw-lite-windows-x64.exe(+.sha256)
 *   webclaw-lite-macos-arm64(+.sha256)
 *   webclaw-lite-linux-x64(+.sha256)
 *   webclaw-x-host.zip(+.sha256)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ASSETS = [
  'webclaw-lite-windows-x64.exe',
  'webclaw-lite-windows-x64.exe.sha256',
  'webclaw-lite-macos-arm64',
  'webclaw-lite-macos-arm64.sha256',
  'webclaw-lite-linux-x64',
  'webclaw-lite-linux-x64.sha256',
  'webclaw-x-host.zip',
  'webclaw-x-host.zip.sha256',
]

function loadOssConfig() {
  const candidates = [
    process.env.WEBCLAW_OSS_CONFIG,
    path.join(repoRoot, 'tools', 'oss.local.json'),
    'D:/tools/harness-apps/fengxing-desktop/tools/oss.local.json',
    'D:\\tools\\harness-apps\\fengxing-desktop\\tools\\oss.local.json',
  ].filter(Boolean)
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cfg = {
      region: String(raw.region || 'oss-cn-beijing').trim(),
      bucket: String(raw.bucket || '').trim(),
      accessKeyId: String(raw.accessKeyId || '').trim(),
      accessKeySecret: String(raw.accessKeySecret || '').trim(),
      publicBaseUrl: String(
        raw.publicBaseUrl || 'https://feixingai-agent.oss-cn-beijing.aliyuncs.com',
      )
        .trim()
        .replace(/\/+$/, ''),
      _file: file,
    }
    if (cfg.bucket && cfg.accessKeyId && cfg.accessKeySecret) return cfg
  }
  throw new Error(
    'OSS credentials not found. Set WEBCLAW_OSS_CONFIG or create tools/oss.local.json',
  )
}

async function main() {
  const version = String(argValue('--version') || '0.2.1').replace(/^v/, '')
  const dir =
    argValue('--dir') || path.join(process.env.TEMP || '/tmp', `webclaw-x-oss-v${version}`)
  const cfg = loadOssConfig()
  let OSS
  try {
    OSS = require('ali-oss')
  } catch {
    // Prefer fengxing-desktop's installed ali-oss
    try {
      OSS = require('D:/tools/harness-apps/fengxing-desktop/node_modules/ali-oss')
    } catch {
      throw new Error('缺少 ali-oss。可在 fengxing-desktop 执行 npm install，或本仓 npm i ali-oss')
    }
  }

  const client = new OSS({
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    secure: true,
    timeout: 600_000,
  })

  const prefix = `webclaw-x/v${version}`
  const baseUrl = `${cfg.publicBaseUrl}/${prefix}`
  const uploaded = []

  for (const name of ASSETS) {
    const local = path.join(dir, name)
    if (!fs.existsSync(local)) {
      console.log(`upload_oss: skip missing ${name}`)
      continue
    }
    const size = fs.statSync(local).size
    if (size <= 0) throw new Error(`empty asset: ${local}`)
    if (!name.endsWith('.sha256') && !name.endsWith('.zip') && size < 10 * 1024 * 1024) {
      throw new Error(`asset too small (${size}): ${local}`)
    }
    if (name.endsWith('.zip') && size < 1024) {
      throw new Error(`host zip too small: ${local}`)
    }
    const key = `${prefix}/${name}`
    console.log(`upload_oss: put ${key} (${(size / (1024 * 1024)).toFixed(2)} MB)`)
    await client.put(key, local, {
      headers: {
        'Cache-Control': name.endsWith('.sha256')
          ? 'public, max-age=3600'
          : 'public, max-age=31536000, immutable',
      },
    })
    uploaded.push(name)
  }

  if (uploaded.length === 0) {
    throw new Error(`no assets uploaded from ${dir}`)
  }

  const latest = {
    version,
    baseUrl,
    assets: uploaded.filter((n) => !n.endsWith('.sha256')),
    updatedAt: new Date().toISOString(),
  }
  await client.put(
    'webclaw-x/latest.json',
    Buffer.from(`${JSON.stringify(latest, null, 2)}\n`),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    },
  )

  console.log('upload_oss: done')
  console.log(`  config: ${cfg._file}`)
  console.log(`  base:   ${baseUrl}`)
  console.log(`  latest: ${cfg.publicBaseUrl}/webclaw-x/latest.json`)
  console.log('  installers should prefer this OSS base before GitHub mirrors.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
