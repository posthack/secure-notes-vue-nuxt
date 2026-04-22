import { eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { file } from '../../database/schema'
import { requireUser } from '../../utils/session'

// список отдаёт только meta (обёртка ключа + шифрованное имя), чанки не тащим
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await db.select().from(file).where(eq(file.userId, user.id))
  return rows.map((r) => ({
    id: r.id,
    noteId: r.noteId,
    meta: JSON.parse(r.meta),
    updatedAt: r.updatedAt,
    deleted: r.deleted,
  }))
})
