// GET /api/preview/<id>: the item's preview, made from where it lives (link, folder or video). ?refresh=1 redraws it.
import { findItem } from "@/lib/library";
import { previewOf } from "@/lib/previews";

const pending = new Map<string, ReturnType<typeof previewOf>>(); // one job per item even when rows ask at once

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await findItem(id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });
  const refresh = new URL(req.url).searchParams.has("refresh");
  if (!pending.has(id)) pending.set(id, previewOf(item, refresh).finally(() => pending.delete(id)));
  return Response.json(await pending.get(id));
}
