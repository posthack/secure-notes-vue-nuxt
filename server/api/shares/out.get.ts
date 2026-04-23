import { eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { share, user } from '../../database/schema'
import { requireUser } from '../../utils/session'

// то, чем поделился я — чтобы показать и дать отозвать
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const rows = await db
    .select({
      id: share.id,
      noteId: share.noteId,
      recipientEmail: user.email,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    })
    .from(share)
    .innerJoin(user, eq(user.id, share.recipientId))
    .where(eq(share.ownerId, me.id))

  return rows
})
