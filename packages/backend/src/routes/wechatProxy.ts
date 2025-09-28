import type { Handler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import type { HonoEnv } from '../../hono'

export const proxyWechatHandler: Handler<HonoEnv> = async (
  ctx,
): Promise<Response> => {
  const url = new URL(ctx.req.url)
  const path = url.pathname.split('/').toSpliced(0, 2).join('/')
  if (!path) {
    return ctx.json({ error: 'The proxied path is null' }, { status: 400 })
  }

  ctx.header('Access-Control-Allow-Origin', '*')
  ctx.header('Access-Control-Allow-Methods', '*')
  ctx.header('Access-Control-Allow-Headers', '*')

  // Handle OPTIONS request
  if (ctx.req.method == 'OPTIONS') {
    return ctx.json({})
  }

  let endpoint = `https://api.weixin.qq.com/${path}`
  const params = url.searchParams
  if (params.size > 0) {
    endpoint += `?${params}`
  }

  // Match request headers
  const requestInit: RequestInit = { method: ctx.req.method }
  if (ctx.req.header('Content-Type')?.startsWith('application/json')) {
    const body = await ctx.req.json()
    requestInit.body = JSON.stringify(body)
  } else if (
    ctx.req.header('Content-Type')?.startsWith('multipart/form-data')
  ) {
    const formData = new FormData()
    const body = await ctx.req.formData()
    body.forEach((value, key) => {
      formData.append(key, value)
    })
    requestInit.body = formData
  } else {
    requestInit.body = ctx.req.raw.body
    // https://fetch.spec.whatwg.org/#enumdef-requestduplex `duplex` needs to be set when body is a ReadableStream object.
    // @ts-expect-error - `duplex` is not in the RequestInit type
    requestInit.duplex = 'half'
  }

  // eslint-disable-next-line no-console
  console.log(
    `${ctx.req.method} ${endpoint} ingress_headers=%o req=%o`,
    ctx.req.raw.headers,
    requestInit,
  )

  // The headers are immutable if the response is received from a fetch() call.
  // So we have to create a new Response that could be appended with a `Set-Cookie` header.
  const response = await fetch(endpoint, requestInit)
  const data = await response.json()

  // eslint-disable-next-line no-console
  console.log(
    `${ctx.req.method} ${endpoint} ${response.status} headers=%o data=%o`,
    response.headers,
    data,
  )

  response.headers.forEach((value, key) => {
    ctx.header(key, value)
  })
  ctx.status(response.status as StatusCode)
  return ctx.body(JSON.stringify(data))
}
