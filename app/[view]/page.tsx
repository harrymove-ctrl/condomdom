// /library, /gallery, /explorer, /workflow: the same page, opened on that view. ?item=<id> opens an item.
import { notFound } from "next/navigation";
import { Library } from "@/components/Library";
import { VIEW_LIST } from "@/lib/types";
import { readItems, readStages } from "@/lib/library";

export const dynamic = "force-dynamic";

export default async function ViewPage({ params, searchParams }: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const [{ view }, { item }] = await Promise.all([params, searchParams]);
  if (!(VIEW_LIST as readonly string[]).includes(view)) notFound();
  const [items, stages] = await Promise.all([readItems(), readStages()]);
  return <Library initialItems={items} stages={stages} initialView={view} initialItem={item ?? null} />;
}
