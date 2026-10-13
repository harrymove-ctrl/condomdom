export const KINDS = ["component", "video", "skill", "read", "tool", "inspiration"] as const;
/** The page's views, each at its own address: /library, /gallery, /explorer, /workflow. */
export const VIEW_LIST = ["library", "gallery", "explorer", "workflow"] as const;
export const STAGES = ["inspire", "design", "build", "ship", "learn"] as const;
export const STATUSES = ["core", "using", "to-try"] as const;
/** What it costs to use. "freemium": free to start, with paid pro parts. "unknown": not checked or not clear. */
export const PRICINGS = ["free", "freemium", "paid", "unknown"] as const;

export type Kind = (typeof KINDS)[number];
export type StageId = (typeof STAGES)[number];
export type Status = (typeof STATUSES)[number];
export type Pricing = (typeof PRICINGS)[number];

export interface Item {
  id: string;
  title: string;
  kind: Kind;
  stage: StageId;
  status: Status;
  /** A category inside its kind, e.g. "animated-react" or "svelte": a folder in the explorer. */
  group?: string;
  pricing?: Pricing;
  /** More pages on the same site: specific components, docs, an old address. */
  also?: { label: string; url: string }[];
  /** Set when the link couldn't be verified automatically, with why (blocked, server error). */
  check?: string;
  /** A longer description, read from the page by pnpm enrich. */
  about?: string;
  /** Pictures made by pnpm enrich, under media/: a screenshot of the page and its share image. */
  media?: { shot?: string; og?: string };
  url?: string;
  path?: string;
  file?: string;
  summary?: string;
  note?: string;
  tags: string[];
  added: string; // YYYY-MM-DD
}

export interface Stage {
  id: StageId;
  label: string;
  question: string;
  playbook: string[];
}

export const KIND_PLURAL: Record<Kind, string> = {
  component: "components", video: "videos", skill: "skills", read: "reads", tool: "tools", inspiration: "inspiration",
};
export const PRICING_LABEL: Record<Pricing, string> = { free: "free", freemium: "free + pro", paid: "paid", unknown: "?" };
export const STATUS_LABEL: Record<Status, string> = { core: "core", using: "using", "to-try": "to try" };
export const STATUS_MARK: Record<Status, string> = { core: "●", using: "◐", "to-try": "○" };
export const STATUS_RANK: Record<Status, number> = { core: 0, using: 1, "to-try": 2 };
