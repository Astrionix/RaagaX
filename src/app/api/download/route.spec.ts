import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { GET } from './route'

const request = (query: string) => new NextRequest(`https://raagax.test/api/download${query}`)

describe('download proxy route', () => {
  it('rejects a missing url', async () => {
    const res = await GET(request(''))

    expect(res.status).toBe(400)
  })

  it('rejects hosts outside the allowlist', async () => {
    const res = await GET(request('?url=https%3A%2F%2Fexample.com%2Ftrack.mp3'))

    expect(res.status).toBe(400)
  })

  it('rejects an allowlisted host over a non https scheme', async () => {
    const res = await GET(request('?url=http%3A%2F%2Fc.saavncdn.com%2Ftrack.mp3'))

    expect(res.status).toBe(400)
  })

  it('rejects a host that only suffixes an allowlisted domain', async () => {
    const res = await GET(request('?url=https%3A%2F%2Fevil-saavncdn.com%2Ftrack.mp3'))

    expect(res.status).toBe(400)
  })
})
