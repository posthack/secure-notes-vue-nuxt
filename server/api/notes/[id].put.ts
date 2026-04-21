import { db } from '../../database/db'
import { note } from '../../database/schema'
import { requireUser } from '../../utils/session'

// env для сервера — непрозрачный шифртекст, разбирать его он не может и не должен
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ env: unknown; updatedAt: number; deleted?: boolean }>(event)

  const values = {
    id,
    userId: user.id,
    env: JSON.stringify(body.env),
    updatedAt: body.updatedAt,
    deleted: body.deleted ?? false,
  }

  await db
    .insert(note)
    .values(values)
    .onConflictDoUpdate({
      target: note.id,
      set: { env: values.env, updatedAt: values.updatedAt, deleted: values.deleted },
    })

  return { ok: true }
})
