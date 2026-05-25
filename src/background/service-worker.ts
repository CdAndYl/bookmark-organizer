import { dispatch } from "./handlers";
import type { Command } from "@/core/messaging/protocol";

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[bookmark-organizer] installed:", details.reason);
});

chrome.runtime.onMessage.addListener((message: Command, _sender, sendResponse) => {
  if (!message || typeof message !== "object" || !("command" in message)) {
    return false;
  }
  (async () => {
    try {
      const result = await dispatch(message);
      sendResponse({ ok: true, result });
    } catch (error) {
      const errMsg = (error as Error).message ?? String(error);
      console.error("[bookmark-organizer] handler failed:", message.command, errMsg);
      sendResponse({ ok: false, error: errMsg });
    }
  })();
  return true;
});

export {};
