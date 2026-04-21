import { db } from '../database/db'
import { vault } from '../database/schema'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ meta: unknown }>(event)
  const meta = JSON.stringify(body.meta)
  const updatedAt = Date.now()

  await db
    .insert(vault)
    .values({ userId: user.id, meta, updatedAt })
    .onConflictDoUpdate({ target: vault.userId, set: { meta, updatedAt } })

  return { ok: true }
})
