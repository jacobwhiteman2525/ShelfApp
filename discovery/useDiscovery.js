import { useEffect, useRef, useState } from 'react';
import { rawg } from './client';
import { mergePages } from './model';

const empty = { games: [], page: 0, hasMore: false, cached: false };

export function useDebouncedSearch(value) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    if (!value) {
      setSearch('');
      return;
    }
    const timer = setTimeout(() => setSearch(value), 400);
    return () => clearTimeout(timer);
  }, [value]);
  return value ? search : '';
}

export function useDiscovery(filters) {
  const key = filters && JSON.stringify(filters);
  const [state, setState] = useState(empty);
  const session = useRef(null);

  async function load(current, page, refresh = false) {
    if (current.busy) return;
    current.busy = true;
    setState(old => ({ ...old, key: current.key, loading: true, error: null }));
    try {
      const { search, ...filters } = current.filters;
      const result = search ? await rawg.search(search, filters, page, refresh)
        : await rawg.list(filters, page, refresh);
      if (session.current !== current) return;
      setState(old => ({
        key: current.key, page, hasMore: result.data.hasMore,
        games: mergePages(page === 1 ? [] : old.games, result.data.results),
        cached: Boolean(result.cached || (page > 1 && old.cached)),
        warning: result.warning || (page > 1 ? old.warning : null),
      }));
    } catch (error) {
      if (session.current === current) {
        setState(old => ({ ...old, loading: false, error: error.message, failedPage: page }));
      }
    } finally {
      current.busy = false;
    }
  }

  useEffect(() => {
    if (!key) return;
    const current = { key, filters: JSON.parse(key) };
    session.current = current;
    setState({ ...empty, key, loading: true });
    load(current, 1);
    return () => { session.current = null; };
  }, [key]);

  const visible = state.key === key ? state : { ...empty, loading: true };
  return {
    ...visible,
    more: () => {
      if (session.current?.key === key && visible.hasMore) load(session.current, visible.page + 1);
    },
    retry: () => {
      if (session.current?.key === key) {
        if (session.current.busy) return;
        const page = visible.failedPage || 1;
        if (page === 1) setState({ ...empty, key, loading: true });
        load(session.current, page, true);
      }
    },
  };
}

export function usePlatforms() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ platforms: [], loading: true });
  useEffect(() => {
    let active = true;
    const platforms = new Map();
    setState(old => ({ ...old, loading: true, error: null }));
    (async () => {
      let warning;
      try {
        for (let page = 1; active; page += 1) {
          const result = await rawg.platforms(page, attempt > 0);
          if (!active) return;
          warning ||= result.warning;
          for (const platform of result.data.results) platforms.set(platform.id, platform);
          if (!result.data.hasMore) break;
        }
      } catch (error) {
        warning = error.message;
      }
      if (active) {
        const options = [...platforms.values()].sort((a, b) => a.name.localeCompare(b.name));
        setState(old => ({
          platforms: warning && !options.length ? old.platforms : options,
          error: warning,
        }));
      }
    })();
    return () => { active = false; };
  }, [attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
