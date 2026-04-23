import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { db } from '../../database/db'
import { share, user } from '../../database/schema'
import { requireUser } from '../../utils/session'

// то, чем поделились со мной; протухшие не отдаём
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const now = Date.now()

  const rows = await db
    .select({
      id: share.id,
      noteId: share.noteId,
      iv: share.iv,
      ct: share.ct,
      wrappedKey: share.wrappedKey,
      expiresAt: share.expiresAt,
      ownerEmail: user.email,
    })
    .from(share)
    .innerJoin(user, eq(user.id, share.ownerId))
    .where(and(eq(share.recipientId, me.id), or(isNull(share.expiresAt), gt(share.expiresAt, now))))

  return rows
})
