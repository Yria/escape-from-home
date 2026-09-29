// 운영 서버: dist 정적 파일 + 요청마다 소모임 게시판을 새로 수집하는 data/events.json
// 사용법: pnpm build && pnpm start   (PORT 기본 3000)
// 소모임 API 에 CORS 가 없어 브라우저가 직접 부를 수 없으므로 이 서버가 대신 수집한다.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSnapshot } from '@escape-from-home/somoim'
import { DATA_PATH, createSnapshotHandler } from './vite/snapshotHandler.ts'

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT ?? 3000)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error(`[server] ${distDir}/index.html 이 없습니다. 먼저 'pnpm build' 를 실행해 주세요.`)
  process.exit(1)
}

const handleData = createSnapshotHandler({
  collect: () => buildSnapshot(),
  fallbackPath: path.join(distDir, DATA_PATH),
  warn: (msg) => console.warn(msg),
})

createServer((req, res) => {
  void handleData(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let file = path.join(distDir, pathname)
    // dist 밖으로 나가는 경로는 막고, 없는 경로는 index.html 로 보낸다
    if (!file.startsWith(distDir + path.sep) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(distDir, 'index.html')
    }
    const ext = path.extname(file)
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    // 해시가 붙은 빌드 산출물만 오래 캐시하고 index.html 은 매번 확인한다
    res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(file).pipe(res)
  })
}).listen(port, () => {
  console.log(`[server] http://localhost:${port}`)
})
