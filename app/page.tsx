import { Library } from "@/components/Library";
import { readItems, readStages } from "@/lib/library";

// The library file changes as you add things, so read it on every request.
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [items, stages, { item }] = await Promise.all([readItems(), readStages(), searchParams]);
  return <Library initialItems={items} stages={stages} initialView="library" initialItem={item ?? null} />;
}
