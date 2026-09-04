import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

export function useCalls({ pollInterval = 15000 } = {}) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await api.getCalls();
      setCalls(result.data || []);
      setError("");
      return result.data || [];
    } catch (requestError) {
      if (!silent) setError(requestError.message || "Unable to load call history.");
      throw requestError;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => refresh().catch(() => undefined), 0);
    if (!pollInterval) return () => window.clearTimeout(initialLoad);
    const timer = window.setInterval(() => refresh({ silent: true }).catch(() => undefined), pollInterval);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [pollInterval, refresh]);

  const addOrUpdateCall = useCallback((call) => {
    if (!call?._id) return;
    setCalls((current) => [call, ...current.filter((item) => item._id !== call._id)]);
  }, []);

  return { calls, loading, error, refresh, addOrUpdateCall };
}
