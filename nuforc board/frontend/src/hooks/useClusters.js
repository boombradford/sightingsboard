import { useEffect, useRef, useState } from "react";
import { fetchJSON } from "../lib/api";

const DEFAULT_PARAMS = {
  time_window_days: 30,
  radius_km: 80,
  min_cluster_size: 3,
  limit: 12,
};

export function useClusters(params) {
  const [clusters, setClusters] = useState([]);
  const [meta, setMeta] = useState({ total_geocoded: 0, params: DEFAULT_PARAMS });
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

  const tw = params?.time_window_days ?? null;
  const rk = params?.radius_km ?? null;
  const ms = params?.min_cluster_size ?? null;
  const lim = params?.limit ?? null;

  useEffect(() => {
    if (tw === null) return;
    const seq = ++seqRef.current;
    setLoading(true);

    const qs = new URLSearchParams();
    qs.set("time_window_days", String(tw));
    qs.set("radius_km", String(rk ?? 80));
    qs.set("min_cluster_size", String(ms ?? 3));
    qs.set("limit", String(lim ?? 12));

    fetchJSON(`/api/clusters?${qs}`)
      .then((payload) => {
        if (seq !== seqRef.current) return;
        setClusters(Array.isArray(payload.clusters) ? payload.clusters : []);
        setMeta({ total_geocoded: payload.total_geocoded ?? 0, params: payload.params ?? {} });
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setClusters([]);
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, [tw, rk, ms, lim]);

  return { clusters, meta, loading };
}
