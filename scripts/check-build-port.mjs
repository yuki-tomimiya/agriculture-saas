import { createConnection } from 'node:net'

const port = Number(process.argv[2] ?? '3000')

function canConnect(host) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port, host, timeout: 1000 })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', error => {
      socket.destroy()
      const ipv6Unavailable = host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || ipv6Unavailable) {
        resolve(false)
      } else {
        reject(error)
      }
    })
  })
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('確認するポート番号が不正なため build を中止します。')
  process.exitCode = 1
} else {
  // Windowsでは待ち受けに成功しても、そのポートが空いているとは限らない。
  const results = await Promise.allSettled(['127.0.0.1', '::1'].map(canConnect))
  if (results.some(result => result.status === 'fulfilled' && result.value)) {
    console.error(`${port}番ポートが使用中です。開発サーバーなどを止めてから build してください。型の確認は npx tsc --noEmit を使えます。`)
    process.exitCode = 1
  } else {
    const failure = results.find(result => result.status === 'rejected')
    if (failure) {
      const error = failure.reason
      console.error(`${port}番ポートの空きを確認できないため build を中止します（${error.code ?? error.message}）。`)
      process.exitCode = 1
    }
  }
}
