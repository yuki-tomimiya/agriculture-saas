import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer, type Server } from 'node:net'
import { test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)

function listen(server: Server, host: string, ipv6Only = false) {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host, port: 0, ipv6Only }, () => {
      server.off('error', reject)
      const address = server.address()
      assert.ok(address && typeof address !== 'string')
      assert.notEqual(address.port, 3000)
      resolve(address.port)
    })
  })
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
}

function checkBuildPort(port: number) {
  return run(process.execPath, ['scripts/check-build-port.mjs', String(port)], { timeout: 5000 })
}

for (const { host, ipv6Only } of [
  { host: '127.0.0.1' },
  { host: '::' },
  { host: '0.0.0.0' },
  { host: '::', ipv6Only: true },
]) {
  test(`${host}${ipv6Only ? '（IPv6のみ）' : ''} で待ち受けているポートではビルド前の確認が止まる`, async t => {
    const server = createServer(socket => socket.end())
    let port: number
    try {
      port = await listen(server, host, ipv6Only)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (host === '::' && (code === 'EAFNOSUPPORT' || code === 'EADDRNOTAVAIL')) {
        t.skip('IPv6を使えない環境')
        return
      }
      throw error
    }
    t.after(() => close(server))

    await assert.rejects(checkBuildPort(port), {
      code: 1,
      message: new RegExp(`${port}番ポートが使用中です`),
    })
  })
}

test('待ち受けが無いポートではビルド前の確認を通過する', async () => {
  const server = createServer()
  const port = await listen(server, '127.0.0.1')
  await close(server)

  const { stderr } = await checkBuildPort(port)
  assert.equal(stderr, '')
})
