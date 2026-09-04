import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

export function useCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const result = await api.getCalls();

      const data = Array.isArray(result?.data)
        ? result.data
        : [];

      setCalls(data);
      setError("");

      return data;
    } catch (requestError) {
      const message =
        requestError?.message ||
        "Unable to load call history.";

      setError(message);

      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return {
    calls,
    loading,
    error,
    refresh,
  };
}