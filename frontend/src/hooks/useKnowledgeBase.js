import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

const emptyKnowledge = {
  companyName: "",
  description: "",
  services: [],
  pricing: "",
  support: "",
  contact: "",
  faq: [],
};

export function useKnowledgeBase() {
  const [knowledge, setKnowledge] = useState(emptyKnowledge);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const result = await api.getKnowledge();

      const value = {
        ...emptyKnowledge,
        ...(result.data || {}),
      };

      setKnowledge(value);
      setError("");

      return value;
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to load the Knowledge Base."
      );

      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      refresh().catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

  const save = useCallback(async (payload) => {
    const result = await api.updateKnowledge(payload);

    const value = {
      ...emptyKnowledge,
      ...(result.data || {}),
    };

    setKnowledge(value);

    return value;
  }, []);

  return {
    knowledge,
    setKnowledge,
    loading,
    error,
    refresh,
    save,
  };
}