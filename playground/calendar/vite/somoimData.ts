import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createServer, type Plugin, type ViteDevServer } from 'vite'
import { DATA_PATH, createSnapshotHandler } from './snapshotHandler.ts'

type SomoimModule = typeof import('@escape-from-home/somoim')

/**
 * 소모임 게시판 → ScheduleSnapshot 을 dev·preview 에서는 요청마다 라이브로 수집해 제공한다.
 * build 에서는 라이브 수집이 실패할 때 쓸 대체본을 dist/data/events.json 으로 남긴다.
 * somoim 패키지는 TS 소스라 dev 에서는 Vite 모듈 러너(ssrLoadModule)로 불러온다.
 */
export function somoimData(): Plugin {
  let root = process.cwd()
  let outDir = 'dist'
  let isBuild = false

  async function load(server: ViteDevServer): Promise<SomoimModule> {
    return (await server.ssrLoadModule('@escape-from-home/somoim')) as SomoimModule
  }

  return {
    name: 'efh:somoim-data',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
    },
    configureServer(server) {
      server.middlewares.use(
        createSnapshotHandler({
          collect: async () => (await load(server)).buildSnapshot(),
          fallbackPath: path.join(root, 'public', DATA_PATH),
          warn: (msg) => server.config.logger.warn(msg),
        }),
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createSnapshotHandler({
          collect: async () => (await import('@escape-from-home/somoim')).buildSnapshot(),
          fallbackPath: path.join(outDir, DATA_PATH),
          warn: (msg) => server.config.logger.warn(msg),
        }),
      )
    },
    // public/ 복사가 끝난 뒤 덮어써야 하므로 closeBundle 에서 직접 쓴다
    closeBundle: {
      sequential: true,
      async handler() {
      if (!isBuild) return
      let json: string
      try {
        const server = await createServer({
          root,
          configFile: false,
          logLevel: 'silent',
          server: { middlewareMode: true, hmr: false, ws: false },
          appType: 'custom',
        })
        try {
          const snapshot = await (await load(server)).buildSnapshot()
          json = JSON.stringify(snapshot)
          this.info(`소모임 일정 ${snapshot.events.length}건 수집`)
        } finally {
          await server.close()
        }
      } catch (err) {
        const fallback = path.join(root, 'public', DATA_PATH)
        if (!existsSync(fallback)) {
          this.error(
            `소모임 게시판 수집 실패, 대체할 ${path.relative(root, fallback)} 도 없습니다. ` +
              `네트워크를 확인하거나 'pnpm --filter @escape-from-home/somoim sync' 로 먼저 만들어 주세요. (${String(err)})`,
          )
        }
        this.warn(`소모임 수집 실패 → public/${DATA_PATH} 사용: ${String(err)}`)
        json = readFileSync(fallback, 'utf8')
      }
      const out = path.join(outDir, DATA_PATH)
      mkdirSync(path.dirname(out), { recursive: true })
      writeFileSync(out, json)
      },
    },
  }
}
