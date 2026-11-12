import { createServer } from 'node:net'

const port = 3000

function checkPort(host) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen({ port, host, ipv6Only: host === '::' }, () => {
      server.close(error => error ? reject(error) : resolve())
    })
  })
}

try {
  await checkPort('0.0.0.0')
  try {
    await checkPort('::')
  } catch (error) {
    if (error.code !== 'EAFNOSUPPORT' && error.code !== 'EADDRNOTAVAIL') throw error
  }
} catch (error) {
  console.error(error.code === 'EADDRINUSE'
    ? '3000番ポートが使用中です。開発サーバーなどを止めてから build してください。型の確認は npx tsc --noEmit を使えます。'
    : `3000番ポートの空きを確認できないため build を中止します（${error.code ?? error.message}）。`)
  process.exitCode = 1
}
