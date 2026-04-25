import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getHires } from "./dataStore";

type AuthResult = {
  ok: boolean;
  status: 200 | 401 | 403;
  userId?: string;
};

const allowUnauthedDemoAccess =
  process.env.RUNBOOK_ALLOW_UNAUTH_HIRE_ACCESS !== "false";

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function isUserAuthorizedForHire(_userId: string, hireId: string): Promise<boolean> {
  // Single-company demo model: any authenticated user can operate on company hires.
  const hires = await getHires();
  return hires.some((hire) => hire.id === hireId);
}

export async function requireHireAccess(hireId: string): Promise<AuthResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    if (!allowUnauthedDemoAccess) {
      return { ok: false, status: 401 };
    }
    const hires = await getHires();
    const exists = hires.some((hire) => hire.id === hireId);
    if (!exists) return { ok: false, status: 403 };
    return { ok: true, status: 200, userId: "demo-user" };
  }
  const authorized = await isUserAuthorizedForHire(userId, hireId);
  if (!authorized) {
    return { ok: false, status: 403, userId };
  }
  return { ok: true, status: 200, userId };
}
