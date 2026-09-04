import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Prioritize Cloudflare and Enterprise reverse proxy client IP headers
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  const trueClientIp = req.headers.get("true-client-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  let rawIp =
    cfConnectingIp?.trim() ||
    trueClientIp?.trim() ||
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    realIp?.trim() ||
    "127.0.0.1";

  // Strip port if present in IPv4 (e.g., 192.168.1.1:8080)
  if (rawIp.includes(":") && rawIp.includes(".")) {
    rawIp = rawIp.split(":")[0];
  }

  // 2. Derive subnet key
  // IPv4: First 3 octets (/24 subnet), e.g., 192.168.1.x
  // IPv6: First 4 hextets (/64 prefix)
  let subnetKey = rawIp;
  if (rawIp.includes(".")) {
    subnetKey = rawIp.split(".").slice(0, 3).join(".");
  } else if (rawIp.includes(":")) {
    subnetKey = rawIp.split(":").slice(0, 4).join(":");
  }

  const wifiHash = crypto.createHash("sha256").update(subnetKey).digest("hex").slice(0, 10);

  // Mask IP for safe client diagnostics
  const maskedIp = rawIp.includes(".")
    ? rawIp.split(".").slice(0, 2).join(".") + ".x.x"
    : rawIp.slice(0, 8) + ":****";

  return NextResponse.json(
    {
      wifiHash,
      subnetKeyMasked: maskedIp,
      source: cfConnectingIp ? "cloudflare" : forwardedFor ? "proxy" : "direct",
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}

