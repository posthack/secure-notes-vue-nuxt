import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { share, user } from '../../database/schema'
import { requireUser } from '../../utils/session'

interface Body {
  recipientEmail: string
  noteId: string
  iv: string
  ct: string
  wrappedKey: string
  expiresAt?: number | null
}

export default defineEventHandler(async (event) => {
  const owner = await requireUser(event)
  const body = await readBody<Body>(event)
  const email = body.recipientEmail.trim().toLowerCase()

  const recipient = (await db.select().from(user).where(eq(user.email, email)))[0]
  if (!recipient) throw createError({ statusCode: 404, statusMessage: 'recipient not found' })
  if (recipient.id === owner.id) {
    throw createError({ statusCode: 400, statusMessage: 'нельзя поделиться с самим собой' })
  }

  const id = randomUUID()
  await db.insert(share).values({
    id,
    noteId: body.noteId,
    ownerId: owner.id,
    recipientId: recipient.id,
    iv: body.iv,
    ct: body.ct,
    wrappedKey: body.wrappedKey,
    expiresAt: body.expiresAt ?? null,
    createdAt: Date.now(),
  })

  return { id }
})
