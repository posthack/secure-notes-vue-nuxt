import { and, eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { share } from '../../database/schema'
import { requireUser } from '../../utils/session'

// отзыв: удалить может только владелец шара
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  await db.delete(share).where(and(eq(share.id, id), eq(share.ownerId, me.id)))
  return { ok: true }
})
