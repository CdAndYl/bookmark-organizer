export interface BookmarkUrl {
  id: string;
  parentId: string | undefined;
  topFolderId: string | null;
  title: string;
  url: string;
  safeUrl: string;
  path: string;
  domain: string;
}

export interface Backup {
  id: string;
  at: string;
  total: number;
  root: BackupNode;
}

export interface BackupNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BackupNode[];
}

export interface OrganizeResult {
  status: "organized" | "partial" | "failed";
  totalBefore: number;
  moved: number;
  categoryCounts: Record<string, number>;
  sourceCounts: { rule: number; ai: number };
  ai: AiRunSummary;
  moveFailures: MoveFailure[];
  removeFailures: { id: string; error: string }[];
  backupId: string;
  backupAt: string;
  at: string;
}

export interface MoveFailure {
  id: string;
  title: string;
  url: string;
  error: string;
}

export interface AiRunSummary {
  enabled: boolean;
  mode: AiMode;
  requested: number;
  accepted: number;
  rejected: number;
  error: string | null;
  usage?: AiUsage | null;
}

export interface AiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export type AiMode = "uncertain" | "medium" | "all";

export interface AiSettings {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  mode: AiMode;
  maxItems: number;
}

export interface AiSettingsForUi extends AiSettings {
  hasApiKey: boolean;
  savedAt?: string;
}

export interface PreviewSnapshot {
  status: "ready" | "already-organized";
  total: number;
  categoryCounts: Record<string, number>;
  sourceCounts: { rule: number; ai: number };
  currentTopNames: string[];
  otherChildren: number;
  mobileChildren: number;
  movePlan: MovePlanEntry[];
  backups: BackupSummary[];
  lastResult: OrganizeResult | RestoreResult | null;
  ai: {
    enabled: boolean;
    mode: AiMode;
    hasApiKey: boolean;
    model: string;
    maxItems: number;
  };
  at: string;
}

export interface MovePlanEntry {
  bookmarkId: string;
  title: string;
  url: string;
  fromPath: string;
  toCategoryTitle: string;
  toSubfolderTitle: string;
  source: "rule" | "ai";
  confidence: "high" | "medium" | "low";
}

export interface BackupSummary {
  id: string;
  at: string;
  total: number;
}

export interface RestoreResult {
  status: "restored";
  restoredFrom: string;
  restoredUrls: number;
  preservedNewUrls: number;
  removeFailures: { id: string; error: string }[];
  at: string;
}
