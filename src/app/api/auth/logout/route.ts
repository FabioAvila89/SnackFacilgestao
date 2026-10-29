import { NextResponse } from "next/server";
import { clearSessionCookie, invalidateUserSessionCache, getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    invalidateUserSessionCache(user.userId);
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
