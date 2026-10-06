// Password gate for a presentation published on Vercel (Edge middleware).
// The presentation's middleware.js: `export default createGate({ cookie: 'x_access', salt: 'x', ... })`.
// Env: SITE_PASSWORD (required, fails closed), QR_TOKEN (optional key printed in a QR code).
import { next } from '@vercel/functions'

/**
 * @param {{
 *   cookie: string,                      cookie name
 *   salt: string,                        mixed into the password hash (keep it stable: changing it logs everyone out)
 *   publicPaths?: string[],              reachable without the password (login page and its images)
 *   redirects?: Record<string, string>,  path -> path, for logged-in visitors (e.g. '/video': '/video.html')
 *   barePdf?: string,                    the bare address (/ without query) opens this PDF instead of the web version
 *   qrLanding?: string,                  where a QR on / lands (default '/?present')
 * }} o
 */
export function createGate(o) {
  const PUBLIC = new Set(['/login.html', ...(o.publicPaths ?? [])])
  // The cookie holds a hash of the password, never the password itself
  const token = async password => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${o.salt}:${password}`))
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  const cookie = async password => `${o.cookie}=${await token(password)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`

  return async function middleware(request) {
    const url = new URL(request.url)
    const password = process.env.SITE_PASSWORD
    if (!password) return new Response('Accesso non configurato', { status: 503 })

    if (url.pathname === '/login' && request.method === 'POST') {
      const form = await request.formData()
      if (form.get('password') !== password) return Response.redirect(new URL('/login.html?e=1', url), 303)
      return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': await cookie(password) } })
    }

    // A QR code carries its own key (QR_TOKEN), never the password: it sets the same cookie
    const qr = process.env.QR_TOKEN
    if (qr && url.searchParams.get('k') === qr) {
      const to = url.pathname === '/' ? o.qrLanding ?? '/?present' : url.pathname
      return new Response(null, { status: 303, headers: { Location: to, 'Set-Cookie': await cookie(password) } })
    }

    if (PUBLIC.has(url.pathname)) return next()

    const cookies = (request.headers.get('cookie') || '').split(/;\s*/)
    if (cookies.includes(`${o.cookie}=${await token(password)}`)) {
      const to = o.redirects?.[url.pathname] ?? o.redirects?.[url.pathname.replace(/\/$/, '')]
      if (to) return Response.redirect(new URL(to, url), 302)
      if (o.barePdf && url.pathname === '/' && !url.search) {
        // versioned link: a new deploy never shows a cached old PDF
        const v = (process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 7)
        return Response.redirect(new URL(`/${o.barePdf}?v=${v}`, url), 302)
      }
      return next()
    }
    return Response.redirect(new URL('/login.html', url), 307)
  }
}
