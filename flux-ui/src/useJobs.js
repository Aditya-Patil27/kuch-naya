import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';

function upsertById(list, update) {
  const idx = list.findIndex((j) => j.id === update.id);
  if (idx === -1) return [update, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...update };
  return next;
}

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    api.getJobs()
      .then((data) => {
        if (mounted) setJobs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setJobs([]);
      });

    function connect() {
      setWsStatus('connecting');
      const ws = new WebSocket(api.wsUrl());
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('connected');

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const event = msg?.event;
          const data = msg?.data || {};

          if (event === 'job:queued') {
            setJobs((prev) => upsertById(prev, data));
            return;
          }

          if (event === 'job:update' || event === 'job:stage' || event === 'job:complete' || event === 'job:error') {
            setJobs((prev) => upsertById(prev, data));
          }
        } catch {
          // Ignore malformed WS messages.
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        retryRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setWsStatus('error');
      };
    }

    connect();

    return () => {
      mounted = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current && wsRef.current.readyState < 2) {
        wsRef.current.close();
      }
    };
  }, []);

  const activeJobs = useMemo(
    () => jobs.filter((j) => ['queued', 'running'].includes(String(j.status || '').toLowerCase())),
    [jobs]
  );

  const completedJobs = useMemo(
    () => jobs.filter((j) => ['completed', 'failed'].includes(String(j.status || '').toLowerCase())),
    [jobs]
  );

  const blockedCount = useMemo(
    () => jobs.filter((j) => String(j.verdict || '').toUpperCase() === 'BLOCK').length,
    [jobs]
  );

  return { jobs, activeJobs, completedJobs, blockedCount, wsStatus };
}
