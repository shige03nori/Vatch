/**
 * @jest-environment node
 */
jest.mock('../auth', () => ({ auth: jest.fn() }))

import { ok, created, unauthorized, forbidden, notFound, unprocessable, serverError } from '../api'

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
