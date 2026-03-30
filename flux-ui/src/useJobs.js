import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';

const MAX_JOBS = 200;

function upsertById(list, update) {
  if (!update?.id) return list;

  const idx = list.findIndex((j) => j.id === update.id);
  if (idx === -1) return [update, ...list].slice(0, MAX_JOBS);

  const next = [...list];
  next[idx] = { ...next[idx], ...update };
  return next.slice(0, MAX_JOBS);
}

export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryDelayRef = useRef(1000);

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
      if (!mounted) return;

      setWsStatus('connecting');
      const ws = new WebSocket(api.wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        retryDelayRef.current = 1000;
        setWsStatus('connected');
      };

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
        if (!mounted) return;
        setWsStatus('disconnected');

        const jitter = Math.floor(Math.random() * 250);
        const nextDelay = Math.min(retryDelayRef.current * 2, 30000);
        const delay = retryDelayRef.current + jitter;
        retryDelayRef.current = nextDelay;

        retryRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        if (!mounted) return;
        setWsStatus('error');
        try {
          ws.close();
        } catch {
          // Ignore close errors.
        }
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
