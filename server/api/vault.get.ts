import { eq } from 'drizzle-orm'
import { db } from '../database/db'
import { vault } from '../database/schema'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await db.select().from(vault).where(eq(vault.userId, user.id))
  const row = rows[0]
  if (!row) return null
  return { meta: JSON.parse(row.meta), updatedAt: row.updatedAt }
})
