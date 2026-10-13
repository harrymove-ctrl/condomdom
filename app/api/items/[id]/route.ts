import { deleteItem, InputError, updateItem } from "@/lib/library";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const item = await updateItem((await params).id, await req.json());
    return item ? Response.json(item) : Response.json({ error: "not found" }, { status: 404 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: err instanceof InputError ? 400 : 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const removed = await deleteItem((await params).id);
  return removed ? Response.json(removed) : Response.json({ error: "not found" }, { status: 404 });
}
