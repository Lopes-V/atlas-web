import { NextRequest, NextResponse } from "next/server";
import { clearTokens, virtualSession } from "@/lib/virtual-auth";
import { safeReturnTo, sameOrigin } from "@/lib/virtual-contracts";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    !sameOrigin(origin, request.headers.get("host"), request.nextUrl.protocol)
  )
    return new NextResponse("Origem recusada", { status: 403 });
  const form = await request.formData();
  try {
    const session = await virtualSession(true);
    if (session)
      return NextResponse.redirect(
        new URL(safeReturnTo(form.get("returnTo")), origin!),
        303,
      );
  } catch {
    /* Invalid/expired refresh tokens lead back to individual login. */
  }
  await clearTokens();
  return NextResponse.redirect(new URL("/conta", origin!), 303);
}
