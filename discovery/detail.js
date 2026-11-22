import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { rawg } from './client';
import { findSavedMatch, matchOptions } from './savedMatch';

export function useRawgDetails(id) {
  const [state, setState] = useState({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setState({ id, loading: true });
    rawg.details(id, attempt > 0).then(({ data, warning }) => {
      if (active) setState({ id, data, message: warning });
    }).catch(error => {
      if (active) setState({ id, message: error.message });
    });
    return () => { active = false; };
  }, [id, attempt]);
  return {
    ...(state.id === id ? state : { loading: Boolean(id) }),
    retry: () => setAttempt(value => value + 1),
  };
}

export function MetadataLink({ game, Button, textStyle, onLink }) {
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(0);
  const [automatic, setAutomatic] = useState(null);
  const [conflict, setConflict] = useState(false);
  const latest = useRef({ game, onLink });
  latest.current = { game, onLink };

  useEffect(() => {
    let active = true;
    findSavedMatch(latest.current.game, rawg.search, () => active).then(match => {
      if (!active) return;
      if (match.kind === 'match') {
        const [{ candidate, platform }] = match.options;
        if (latest.current.onLink(candidate, platform)) return;
        setConflict(true);
      }
      setAutomatic(match);
    });
    return () => { active = false; };
  }, [game.id]);

  const search = async (nextPage, refresh = false) => {
    setSearching(true);
    try {
      const response = await rawg.search(game.title.slice(0, 120), {}, nextPage, refresh);
      const options = matchOptions(response.data.results, game);
      setPage(nextPage);
      setResult(old => ({
        options: nextPage === 1 ? options : [...old.options, ...options.filter(({ candidate, platform }) =>
          !old.options.some(previous => previous.candidate.providerId === candidate.providerId &&
            previous.platform.id === platform.id))],
        hasMore: response.data.hasMore,
        message: response.warning,
      }));
    } catch (error) {
      setResult(old => ({ ...old, message: error.message, failedPage: nextPage }));
    } finally {
      setSearching(false);
    }
  };

  const options = result?.options || (automatic?.kind === 'confirm' ? automatic.options : []);
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      {!automatic && <Text accessibilityLiveRegion="polite" style={textStyle}>Finding game information…</Text>}
      {automatic?.kind === 'none' && !page && <Text style={textStyle}>
        No reliable RAWG match for this title and platform. You can look for a match manually.
      </Text>}
      {!!automatic?.warning && !page && <Text style={textStyle}>{automatic.warning}</Text>}
      {conflict && <Text style={textStyle}>That RAWG game and platform are already linked to a saved entry.</Text>}
      {!!automatic && !page && <Button disabled={searching} onPress={() => search(1, Boolean(result || automatic.warning))}>
        {searching ? 'Searching RAWG…' : 'Find RAWG metadata'}
      </Button>}
      {!!result?.message && <Text style={textStyle}>{result.message}</Text>}
      {!!page && !result.options?.length && <Text style={textStyle}>
        No matching platform on the pages searched.
      </Text>}
      {options.length > 0 && <Text style={textStyle}>Confirm game match</Text>}
      {options.map(({ candidate, platform }) => (
        <Button
          key={candidate.providerId + ':' + platform.id}
          onPress={() => Alert.alert(
            'Link RAWG metadata?',
            `${candidate.title} · ${platform.name}${candidate.releaseDate ? ' · ' + candidate.releaseDate : ''}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Link', onPress: () => { if (!onLink(candidate, platform)) setConflict(true); } },
            ]
          )}
        >
          {candidate.title} · {platform.name}{candidate.releaseDate ? ' · ' + candidate.releaseDate : ''}
        </Button>
      ))}
      {!!result?.hasMore && <Button disabled={searching} onPress={() => search(page + 1, Boolean(result.failedPage))}>
        {searching ? 'Searching RAWG…' : result.failedPage ? 'Retry matches' : 'More matches'}
      </Button>}
    </View>
  );
}
