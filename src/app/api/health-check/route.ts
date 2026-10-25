import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const envUrl = process.env.POSTGRES_PRISMA_URL;
  const directUrl = process.env.POSTGRES_URL_NON_POOLING;
  const legacyDbUrl = process.env.DATABASE_URL;

  const masked = (url?: string) => {
    if (!url) return "NOT_SET";
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}?${u.searchParams.toString()}`;
    } catch {
      return "INVALID_URL_FORMAT";
    }
  };

  try {
    const rawResult = await prisma.$queryRaw`SELECT 1 as test, current_database() as db, current_user as usr`;
    const userCount = await prisma.user.count();

    return NextResponse.json({
      status: "SUCCESS",
      database: "CONNECTED",
      userCount,
      prismaUrlMasked: masked(envUrl),
      directUrlMasked: masked(directUrl),
      legacyDbUrlMasked: masked(legacyDbUrl),
      dbResult: rawResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "ERROR",
        database: "FAILED_TO_CONNECT",
        errorMessage: error?.message || String(error),
        errorCode: error?.code,
        prismaUrlMasked: masked(envUrl),
        directUrlMasked: masked(directUrl),
        legacyDbUrlMasked: masked(legacyDbUrl),
      },
      { status: 500 }
    );
  }
}
