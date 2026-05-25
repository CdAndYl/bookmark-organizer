import { useCallback, useEffect, useState } from "react";
import { useBackground } from "./useBackground";
import type { RulePack } from "@/core/classifier/ruleSchema";

interface UseRulePackResult {
  pack: RulePack | null;
  isDefault: boolean;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (next: RulePack) => Promise<void>;
  reset: () => Promise<void>;
}

export function useRulePack(): UseRulePackResult {
  const send = useBackground();
  const [pack, setPack] = useState<RulePack | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await send({ command: "get-rules" });
      setPack(res.pack);
      setIsDefault(res.isDefault);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [send]);

  const save = useCallback(
    async (next: RulePack) => {
      const res = await send({ command: "save-rules", pack: next });
      setPack(res.pack);
      setIsDefault(false);
    },
    [send],
  );

  const reset = useCallback(async () => {
    const res = await send({ command: "reset-rules" });
    setPack(res.pack);
    setIsDefault(true);
  }, [send]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { pack, isDefault, loading, error, reload, save, reset };
}
