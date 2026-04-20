import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./.data/sqlite.db'

export const db = drizzle(createClient({ url }), { schema })
