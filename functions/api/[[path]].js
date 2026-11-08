// Keep API requests on the site's origin so session and CSRF cookies work.
export async function onRequest({ request, env }) {
  if (!env.API_ORIGIN) return new Response('API unavailable', { status: 503 })

  const incoming = new URL(request.url)
  const target = new URL(env.API_ORIGIN)
  target.pathname = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  target.search = incoming.search
  const response = await fetch(new Request(target, request), { redirect: 'manual' })
  const headers = new Headers(response.headers)
  const cookies = headers.getAll('Set-Cookie')
  headers.delete('Set-Cookie')
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie.replace(/;\s*Path=\/auth(?=;|$)/i, '; Path=/api/auth'))
  }
  const location = headers.get('Location')
  if (location?.startsWith(env.API_ORIGIN)) {
    headers.set('Location', '/api' + location.slice(env.API_ORIGIN.length))
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
