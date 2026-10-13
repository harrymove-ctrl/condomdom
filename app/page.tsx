import { Library } from "@/components/Library";
import { readItems, readStages } from "@/lib/library";

// The library file changes as you add things, so read it on every request.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [items, stages] = await Promise.all([readItems(), readStages()]);
  return <Library initialItems={items} stages={stages} />;
}
