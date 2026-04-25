import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "embed_session";

function sessionSecret(): string {
  return (
    process.env.RUNBOOK_EMBED_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 48) ||
    "runbook-embed-dev-secret-change-in-production"
  );
}

export type EmbedSessionPayload = {
  githubId: number;
  login: string;
  exp: number;
};

export function signEmbedSession(payload: Omit<EmbedSessionPayload, "exp">): string {
  const body: EmbedSessionPayload = {
    ...payload,
    exp: Date.now() + 7 * 86400000
  };
  const raw = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}

export function verifyEmbedSession(token: string | undefined | null): EmbedSessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [raw, sig] = parts;
  if (!raw || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(raw).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const data = JSON.parse(json) as EmbedSessionPayload;
    if (typeof data.githubId !== "number" || typeof data.login !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export const EMBED_SESSION_COOKIE = COOKIE;
