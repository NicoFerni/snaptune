import { NextResponse, type NextRequest } from "next/server";

// /admin sits behind HTTP Basic auth: any user name, the password in ADMIN_PASSWORD.
// Without ADMIN_PASSWORD set, the panel is not served at all.
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse(null, { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SnapTune admin"' },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
