import { handle } from 'hono/vercel'
import { apiApp } from '@/api-app'

export const GET = handle(apiApp)
export const POST = handle(apiApp)
export const PUT = handle(apiApp)
export const DELETE = handle(apiApp)
export const OPTIONS = handle(apiApp)
