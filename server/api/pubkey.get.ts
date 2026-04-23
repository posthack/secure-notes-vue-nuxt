import { eq } from 'drizzle-orm'
import { db } from '../database/db'
import { user, userKey } from '../database/schema'
import { requireUser } from '../utils/session'

// публичный ключ получателя по почте — нужен, чтобы завернуть ему dek
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const email = String(getQuery(event).email ?? '')
    .trim()
    .toLowerCase()
  if (!email) throw createError({ statusCode: 400, statusMessage: 'email required' })

  const rows = await db
    .select({ publicKey: userKey.publicKey })
    .from(user)
    .innerJoin(userKey, eq(userKey.userId, user.id))
    .where(eq(user.email, email))

  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'no key for that user' })
  return { publicKey: row.publicKey }
})
