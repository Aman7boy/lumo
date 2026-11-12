import type { SessionContext } from './auth'
import type { Env } from './store'

export type AppEnv = { Bindings: Env; Variables: { session: SessionContext } }
