import { addItem, InputError, readItems } from "@/lib/library";

export async function GET() {
  return Response.json({ items: await readItems() });
}

export async function POST(req: Request) {
  try {
    return Response.json(await addItem(await req.json()), { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: err instanceof InputError ? 400 : 500 });
  }
}
