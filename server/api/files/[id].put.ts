import { db } from '../../database/db'
import { file } from '../../database/schema'
import { requireUser } from '../../utils/session'

interface Env {
  v: number
  wrappedKey: string
  meta: unknown
  chunks?: unknown[]
}

// сервер режет конверт на meta и content, но внутрь шифртекста не смотрит
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ noteId: string; env: Env; updatedAt: number; deleted?: boolean }>(
    event,
  )
  const { chunks, ...meta } = body.env

  const values = {
    id,
    userId: user.id,
    noteId: body.noteId,
    meta: JSON.stringify(meta),
    content: JSON.stringify(chunks ?? []),
    updatedAt: body.updatedAt,
    deleted: body.deleted ?? false,
  }

  await db
    .insert(file)
    .values(values)
    .onConflictDoUpdate({
      target: file.id,
      set: {
        meta: values.meta,
        content: values.content,
        updatedAt: values.updatedAt,
        deleted: values.deleted,
      },
    })

  return { ok: true }
})
