import { eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { note } from '../../database/schema'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await db.select().from(note).where(eq(note.userId, user.id))
  return rows.map((r) => ({
    id: r.id,
    env: JSON.parse(r.env),
    updatedAt: r.updatedAt,
    deleted: r.deleted,
  }))
})
