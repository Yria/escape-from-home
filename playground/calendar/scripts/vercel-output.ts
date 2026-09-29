// Vercel 빌드 마지막 단계: vite build 결과(dist)와 수집 함수를 Build Output API(v3) 형태로 .vercel/output 에 만든다.
// Vercel 은 .vercel/output/config.json 이 있으면 자체 변환 없이 이것을 그대로 배포한다.
// (Vercel 이 api/*.ts 를 직접 변환하면 somoim 패키지의 .ts 소스·.ts import 를 풀지 못해 함수가 깨진다.)
// 사용법: pnpm build && node scripts/vercel-output.ts
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, '.vercel/output')
const fn = path.join(out, 'functions/api/events.func')
/** vite/somoimData.ts 가 Vercel 빌드에서 굽는 대체본 */
const fallback = path.join(dist, 'data/events.fallback.json')

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('[vercel-output] dist 가 없습니다. 먼저 pnpm build 를 실행해 주세요.')
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })

// 1) 정적 파일
cpSync(dist, path.join(out, 'static'), { recursive: true })

// 2) 함수: somoim 까지 한 파일(index.mjs)로 묶는다
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: path.join(root, 'server/vercelEvents.ts'),
    outDir: fn,
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
  },
})
if (existsSync(fallback)) cpSync(fallback, path.join(fn, 'events.fallback.json'))
writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', regions: ['icn1'] }, null, 2),
)

// 3) 경로: 정적 파일을 먼저 보고, /data/events.json 은 함수로 보낸다
writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/data/events\\.json$', dest: '/api/events' },
        { handle: 'filesystem' },
      ],
    },
    null,
    2,
  ),
)
console.log(`[vercel-output] ${path.relative(root, out)} 생성 (정적 파일 + api/events 함수)`)
