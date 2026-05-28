import { getDomainPreview, getPreview } from "@/core/organizer/preview";
import { organize } from "@/core/organizer/organize";
import { organizeByDomain } from "@/core/organizer/organizeByDomain";
import { restoreBackup } from "@/core/organizer/restore";
import { deleteBackup } from "@/core/organizer/backup";
import { withRunLock } from "@/core/organizer/lock";
import {
  getAiSettingsForUi,
  normalizeAiSettings,
  saveAiSettings,
} from "@/core/ai/settings";
import { listModels, testAiConnection } from "@/core/ai/client";
import {
  loadActiveRulePack,
  resetToDefaults,
  saveUserRulePack,
} from "@/core/classifier/rulesService";
import type { Command, CommandResultMap } from "@/core/messaging/protocol";

type Handler<K extends Command["command"]> = (
  msg: Extract<Command, { command: K }>,
) => Promise<CommandResultMap[K]>;

const handlers: { [K in Command["command"]]: Handler<K> } = {
  "get-preview": (msg) =>
    msg.mode === "domain" ? getDomainPreview() : getPreview(),
  "organize-now": (msg) =>
    withRunLock(msg.mode === "domain" ? organizeByDomain : organize),
  "restore-backup": (msg) => withRunLock(() => restoreBackup(msg.backupId)),
  "delete-backup": async (msg) => {
    await deleteBackup(msg.backupId);
    return { deletedId: msg.backupId };
  },
  "get-ai-settings": () => getAiSettingsForUi(),
  "save-ai-settings": (msg) => saveAiSettings(msg.settings),
  "list-ai-models": (msg) => listModels(normalizeAiSettings(msg.settings)),
  "test-ai-settings": async (msg) => {
    const { pack } = await loadActiveRulePack();
    return testAiConnection(normalizeAiSettings(msg.settings), pack);
  },
  "get-rules": () => loadActiveRulePack(),
  "save-rules": async (msg) => {
    const pack = await saveUserRulePack(msg.pack);
    return { pack };
  },
  "reset-rules": async () => {
    const pack = await resetToDefaults();
    return { pack };
  },
};

export async function dispatch(message: Command): Promise<unknown> {
  const handler = handlers[message.command] as Handler<typeof message.command>;
  if (!handler) throw new Error(`Unknown command: ${message.command}`);
  return handler(message as never);
}
