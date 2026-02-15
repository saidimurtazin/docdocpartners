import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Extract the parent domain for cookie sharing across subdomains.
 * e.g. "admin.docdocpartners.ru" → ".docdocpartners.ru"
 * For Railway/localhost/IP addresses, returns undefined (browser default).
 */
function getParentDomain(hostname: string): string | undefined {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) return undefined;

  // Railway default domain — no subdomain sharing needed
  if (hostname.endsWith(".up.railway.app")) return undefined;

  // For custom domains like admin.docdocpartners.ru or docdocpartners.ru,
  // set cookie on the parent domain so it works across subdomains
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    // Take last 2 parts: "docdocpartners.ru" → ".docdocpartners.ru"
    const parent = parts.slice(-2).join(".");
    return `.${parent}`;
  }

  return undefined;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const domain = getParentDomain(req.hostname);

  return {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
