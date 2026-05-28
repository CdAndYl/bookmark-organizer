import type {
  AiSettings,
  AiSettingsForUi,
  OrganizeResult,
  PreviewSnapshot,
  RestoreResult,
} from "@/shared/types";
import type { RulePack } from "@/core/classifier/ruleSchema";

/** Organize strategy. Absent defaults to "smart" for backward compatibility. */
export type OrganizeMode = "smart" | "domain";

export type Command =
  | { command: "get-preview"; mode?: OrganizeMode }
  | { command: "organize-now"; mode?: OrganizeMode }
  | { command: "restore-backup"; backupId: string }
  | { command: "delete-backup"; backupId: string }
  | { command: "get-ai-settings" }
  | { command: "save-ai-settings"; settings: AiSettings }
  | { command: "list-ai-models"; settings: AiSettings }
  | { command: "test-ai-settings"; settings: AiSettings }
  | { command: "get-rules" }
  | { command: "save-rules"; pack: RulePack }
  | { command: "reset-rules" };

export interface CommandResultMap {
  "get-preview": PreviewSnapshot;
  "organize-now": OrganizeResult;
  "restore-backup": RestoreResult;
  "delete-backup": { deletedId: string };
  "get-ai-settings": AiSettingsForUi;
  "save-ai-settings": AiSettingsForUi;
  "list-ai-models": { models: string[]; count: number; fetchedAt: string };
  "test-ai-settings": {
    status: "ok";
    model: string;
    items: unknown[];
    usage: unknown | null;
    testedAt: string;
  };
  "get-rules": { pack: RulePack; isDefault: boolean };
  "save-rules": { pack: RulePack };
  "reset-rules": { pack: RulePack };
}

export type CommandName = Command["command"];

export type Response<K extends CommandName> =
  | { ok: true; result: CommandResultMap[K] }
  | { ok: false; error: string };
