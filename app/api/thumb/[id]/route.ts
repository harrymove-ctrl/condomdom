// GET /api/thumb/<id>: the item's link as an ascii drawing, made once and cached. ?refresh=1 makes it again.
import { findItem } from "@/lib/library";
import { makeThumb, readThumb } from "@/lib/thumbs";

const pending = new Map<string, Promise<unknown>>(); // one fetch per item even when rows ask at once

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const refresh = new URL(req.url).searchParams.has("refresh");
  if (!refresh) {
    const cached = await readThumb(id);
    if (cached) return Response.json(cached);
  }
  const item = await findItem(id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });
  if (!pending.has(id)) pending.set(id, makeThumb(item).finally(() => pending.delete(id)));
  return Response.json(await pending.get(id));
}
