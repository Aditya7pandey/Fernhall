export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code)
export const unauthorized = (msg = 'Please sign in to continue') => new HttpError(401, msg, 'UNAUTHORIZED')
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg, 'FORBIDDEN')
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'NOT_FOUND')
export const conflict = (msg: string) => new HttpError(409, msg, 'CONFLICT')

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}
