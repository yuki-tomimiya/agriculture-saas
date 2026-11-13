import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { PrismaClient } from '@prisma/client'

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void }
}

export async function temporarySqlite(t: TestContext) {
  const prefix = 'tilltol-proposal-test-'
  const directory = await mkdtemp(path.join(tmpdir(), prefix))
  const file = path.join(directory, 'test.db')
  const url = `file:${file.replace(/\\/g, '/')}`
  const db = new PrismaClient({ datasources: { db: { url } } })
  t.after(async () => {
    await db.$disconnect()
    const resolved = path.resolve(directory)
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()))
    assert.ok(path.basename(resolved).startsWith(prefix))
    await rm(resolved, { recursive: true, force: true })
  })
  const schema = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff',
    '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
  const sqlite = new DatabaseSync(file)
  try {
    sqlite.exec(schema)
  } finally {
    sqlite.close()
  }
  return { db, file }
}
