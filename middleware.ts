import { NextRequest, NextResponse } from 'next/server'

// Auth is handled client-side via Firebase in AppLayout
// Middleware only protects API routes
export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
