/**
 * @jest-environment node
 */
jest.mock('../auth', () => ({ auth: jest.fn() }))

import { NextResponse } from 'next/server'
import { ok, created, unauthorized, forbidden, notFound, unprocessable, serverError, requireAuth } from '../api'
import { auth as mockAuthFn } from '../auth'

const mockAuth = mockAuthFn as jest.Mock

describe('api helpers', () => {
  it('ok returns 200 with data', async () => {
    const res = ok({ id: '1' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: { id: '1' } })
  })

  it('ok returns 200 with meta', async () => {
    const res = ok([{ id: '1' }], { total: 1, page: 1, limit: 20 })
    const body = await res.json()
    expect(body).toEqual({ success: true, data: [{ id: '1' }], meta: { total: 1, page: 1, limit: 20 } })
  })

  it('created returns 201', async () => {
    const res = created({ id: '1' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ success: true, data: { id: '1' } })
  })

  it('unauthorized returns 401', async () => {
    const res = unauthorized()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  })

  it('forbidden returns 403', async () => {
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('notFound returns 404', async () => {
    const res = notFound()
    expect(res.status).toBe(404)
  })

  it('unprocessable returns 422', async () => {
    const res = unprocessable([{ path: ['title'], message: 'Required' }])
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('serverError returns 500', async () => {
    const res = serverError()
    expect(res.status).toBe(500)
  })
})

describe('requireAuth', () => {
  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const result = await requireAuth()
    expect(result).toBeInstanceOf(NextResponse)
    // @ts-expect-error - result is NextResponse here
    expect(result.status).toBe(401)
  })

  it('returns session and isAdmin=true for ADMIN', async () => {
    const session = { user: { id: 'u1', role: 'ADMIN' } }
    mockAuth.mockResolvedValueOnce(session)
    const result = await requireAuth()
    expect(result).not.toBeInstanceOf(NextResponse)
    const { isAdmin } = result as { session: typeof session; isAdmin: boolean }
    expect(isAdmin).toBe(true)
  })

  it('returns isAdmin=false for STAFF', async () => {
    const session = { user: { id: 'u1', role: 'STAFF' } }
    mockAuth.mockResolvedValueOnce(session)
    const result = await requireAuth()
    const { isAdmin } = result as { session: typeof session; isAdmin: boolean }
    expect(isAdmin).toBe(false)
  })
})
