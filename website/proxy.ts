import { NextResponse, type NextRequest } from "next/server";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";

// /admin sits behind HTTP Basic auth: any user name, the password in ADMIN_PASSWORD.
// Without ADMIN_PASSWORD set, the panel is not served at all.
export function proxy(request: NextRequest) {
  if (!adminEnabled()) return new NextResponse(null, { status: 404 });
  if (isAdmin(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SnapTune admin"' },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
