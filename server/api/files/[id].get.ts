import { and, eq } from 'drizzle-orm'
import { db } from '../../database/db'
import { file } from '../../database/schema'
import { requireUser } from '../../utils/session'

// полный конверт с чанками — по запросу, когда файл реально открывают/качают
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const rows = await db
    .select()
    .from(file)
    .where(and(eq(file.id, id), eq(file.userId, user.id)))
  const row = rows[0]
  if (!row || row.deleted) throw createError({ statusCode: 404, statusMessage: 'not found' })

  const meta = JSON.parse(row.meta)
  return {
    id: row.id,
    noteId: row.noteId,
    env: { ...meta, chunks: JSON.parse(row.content) },
    updatedAt: row.updatedAt,
  }
})
