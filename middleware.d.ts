export function createGate(o: {
  cookie: string
  salt: string
  publicPaths?: string[]
  redirects?: Record<string, string>
  barePdf?: string
  qrLanding?: string
}): (request: Request) => Promise<Response>
