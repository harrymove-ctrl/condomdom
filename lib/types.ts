export const KINDS = ["component", "video", "skill", "read", "tool", "inspiration"] as const;
export const STAGES = ["inspire", "design", "build", "ship", "learn"] as const;
export const STATUSES = ["core", "using", "to-try"] as const;

export type Kind = (typeof KINDS)[number];
export type StageId = (typeof STAGES)[number];
export type Status = (typeof STATUSES)[number];

export interface Item {
  id: string;
  title: string;
  kind: Kind;
  stage: StageId;
  status: Status;
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
export const STATUS_LABEL: Record<Status, string> = { core: "core", using: "using", "to-try": "to try" };
export const STATUS_MARK: Record<Status, string> = { core: "●", using: "◐", "to-try": "○" };
export const STATUS_RANK: Record<Status, number> = { core: 0, using: 1, "to-try": 2 };
