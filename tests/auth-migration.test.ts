import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { temporarySqlite } from './helpers/temporary-sqlite'

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (file: string) => {
    exec(sql: string): void; close(): void;
    prepare(sql: string): { all(): { name: string }[] };
  };
}

test('セッションのマイグレーションは空のDBと既存の利用者・農場・作付けのコピーを保持する', async t => {
  const migration = await readFile('prisma/migrations/20261124090000_session/migration.sql', 'utf8')
  for (const populated of [false, true]) {
    const { db, file } = await temporarySqlite(t)
    if (populated) {
      await db.user.create({ data: { id: 'preserved-user', email: 'preserved@example.invalid', password: 'unchanged-hash' } })
      await db.farm.create({ data: { id: 'preserved-farm', userId: 'preserved-user', name: '消さない農場' } })
      await db.crop.create({ data: { id: 'preserved-crop', farmId: 'preserved-farm', name: '消さない作付け' } })
    }
    const snapshot = async (client: PrismaClient) => ({ users: await client.user.findMany(),
      farms: await client.farm.findMany(), crops: await client.crop.findMany() })
    const before = await snapshot(db)
    await db.$disconnect()
    // 追加前の形にしてからコピーする。開発用DBには触らない。
    const original = new DatabaseSync(file)
    const copy = path.join(path.dirname(file), 'before-session-copy.db')
    try {
      original.exec('DROP TABLE "Session"')
      original.exec(`VACUUM INTO '${copy.replaceAll("'", "''")}'`)
    } finally {
      original.close()
    }
    const sqlite = new DatabaseSync(copy)
    try {
      sqlite.exec('PRAGMA foreign_keys=ON')
      sqlite.exec(migration)
      const indexes = sqlite.prepare('PRAGMA index_list("Session")').all().map(row => row.name)
      for (const index of ['Session_tokenHash_key', 'Session_userId_idx', 'Session_expiresAt_idx']) {
        assert.ok(indexes.includes(index))
      }
      assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0)
    } finally {
      sqlite.close()
    }
    const migrated = new PrismaClient({ datasources: { db: { url: `file:${copy.replaceAll('\\', '/')}` } } })
    t.after(() => migrated.$disconnect())
    try {
      assert.deepEqual(await snapshot(migrated), before)
      assert.equal(await migrated.session.count(), 0)
    } finally {
      await migrated.$disconnect()
    }
  }
})
