import type { Request } from 'express'

/**
 * Express 5 里 `req.params.xxx` 的类型常为 `string | string[]`。
 * 用 `unknown` 入参并在此收窄，避免调用处被推断成联合类型。
 */
export function routeParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : undefined
  }
  return undefined
}

/** 从 `req.params` 取值时先转成 `unknown`，避免返回值被推断成 `string | string[]` */
export function routeReqParam(req: Request, name: string): string | undefined {
  return routeParam((req.params as Record<string, unknown>)[name])
}
