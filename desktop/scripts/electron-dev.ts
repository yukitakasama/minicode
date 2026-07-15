import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

export const DEFAULT_RENDERER_URL = 'http://localhost:1420'
export const LOCAL_NO_PROXY_ENTRIES = ['localhost', '127.0.0.1', '::1']

export function mergeNoProxy(existing: string | undefined, required = LOCAL_NO_PROXY_ENTRIES) {
  const entries = new Set(
    (existing ?? '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  )
  for (const entry of required) entries.add(entry)
  return Array.from(entries).join(',')
}

export function createElectronDevEnv(env: NodeJS.ProcessEnv = process.env) {
  const rendererUrl = env.ELECTRON_RENDERER_URL ?? DEFAULT_RENDERER_URL
  const noProxy = mergeNoProxy(env.NO_PROXY ?? env.no_proxy)
  return {
    ...env,
    ELECTRON_RENDERER_URL: rendererUrl,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  }
}

async function waitForRenderer(rendererUrl: string) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(rendererUrl)
      if (response.ok) return
    } catch {
      await Bun.sleep(500)
    }
  }
  throw new Error(`Timed out waiting for Vite renderer at ${rendererUrl}`)
}

/** Start Vite dev server programmatically, avoiding spawn issues on Windows. */
async function startVite(root: string) {
  // Use dynamic import so vite is only loaded when needed (not in production)
  const vite = await import('vite')
  const server = await vite.createServer({
    root,
    server: { port: 1420, strictPort: true },
  })
  await server.listen()
  return server
}

async function main() {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const childEnv = createElectronDevEnv()
  const rendererUrl = childEnv.ELECTRON_RENDERER_URL
  process.env.NO_PROXY = childEnv.NO_PROXY
  process.env.no_proxy = childEnv.no_proxy

  const viteServer = await startVite(desktopRoot)

  function stopVite() {
    viteServer.close()
  }

  process.on('SIGINT', () => {
    stopVite()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    stopVite()
    process.exit(143)
  })

  await waitForRenderer(rendererUrl)

  const electronPath = resolve(desktopRoot, 'node_modules/electron/dist/electron.exe')
  const electron = Bun.spawn([electronPath, './electron-dist/main.cjs'], {
    cwd: desktopRoot,
    env: childEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await electron.exited
  stopVite()
  process.exit(exitCode)
}

if (import.meta.main) {
  await main()
}
