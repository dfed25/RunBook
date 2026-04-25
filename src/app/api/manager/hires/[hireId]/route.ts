import { NextResponse } from "next/server";
import { removeHire, updateHire } from "@/lib/dataStore";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ hireId: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { hireId } = await params;
    const body = await req.json();
    const updated = await updateHire(hireId, {
      name: typeof body.name === "string" ? body.name : undefined,
      role: typeof body.role === "string" ? body.role : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined
    });
    if (!updated) {
      return NextResponse.json({ error: "Hire not found" }, { status: 404 });
    }
    return NextResponse.json({ hire: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update hire" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { hireId } = await params;
    const body = await req.json().catch(() => ({}));
    const cascadeTasks = Boolean(body.cascadeTasks);
    const reassignToHireId = typeof body.reassignToHireId === "string" ? body.reassignToHireId : undefined;
    const removed = await removeHire(hireId, { cascadeTasks, reassignToHireId });
    if (!removed) {
      return NextResponse.json({ error: "Hire not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete hire" }, { status: 500 });
  }
}
