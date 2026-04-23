import { db } from '../database/db'
import { userKey } from '../database/schema'
import { requireUser } from '../utils/session'

// публикуем свой публичный ключ, чтобы другим было чем заворачивать dek
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ publicKey: string }>(event)
  const updatedAt = Date.now()

  await db
    .insert(userKey)
    .values({ userId: user.id, publicKey: body.publicKey, updatedAt })
    .onConflictDoUpdate({
      target: userKey.userId,
      set: { publicKey: body.publicKey, updatedAt },
    })

  return { ok: true }
})
