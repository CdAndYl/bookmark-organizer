import { useCallback } from "react";
import type {
  Command,
  CommandName,
  CommandResultMap,
} from "@/core/messaging/protocol";

function send<K extends CommandName>(
  message: Extract<Command, { command: K }>,
  timeoutMs = 0,
): Promise<CommandResultMap[K]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            settled = true;
            reject(
              new Error(
                `请求超过 ${Math.round(timeoutMs / 1000)} 秒未返回,请检查接口和网络。`,
              ),
            );
          }, timeoutMs)
        : null;
    chrome.runtime.sendMessage(message, (response) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "操作失败"));
        return;
      }
      resolve(response.result as CommandResultMap[K]);
    });
  });
}

export function useBackground() {
  return useCallback(send, []);
}
