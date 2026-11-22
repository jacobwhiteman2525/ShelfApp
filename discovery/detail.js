import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { rawg } from './client';
import { matchingPlatforms, sameGame, selectPlatform } from './model';
import { RawgAttribution } from './DiscoverScreen';

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

  const search = async (nextPage, refresh = false) => {
    setSearching(true);
    try {
      const response = await rawg.search(game.title.slice(0, 120), {}, nextPage, refresh);
      const options = response.data.results.flatMap(candidate => matchingPlatforms(candidate, game)
        .map(platform => ({ candidate, platform })));
      setPage(nextPage);
      setResult(old => ({
        options: nextPage === 1 ? options : [...old.options, ...options.filter(option =>
          !old.options.some(previous => sameGame(
            selectPlatform(previous.candidate, previous.platform),
            selectPlatform(option.candidate, option.platform)
          )))],
        hasMore: response.data.hasMore,
        message: response.warning,
      }));
    } catch (error) {
      setResult(old => ({ ...old, message: error.message, failedPage: nextPage }));
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      {!page && <Button disabled={searching} onPress={() => search(1, Boolean(result))}>
        {searching ? 'Searching RAWG…' : 'Find RAWG metadata'}
      </Button>}
      {!!result?.message && <Text style={textStyle}>{result.message}</Text>}
      {!!page && <RawgAttribution />}
      {!!page && !result.options?.length && <Text style={textStyle}>
        No matching platform on the pages searched.
      </Text>}
      {result?.options?.map(({ candidate, platform }) => (
        <Button
          key={candidate.providerId + ':' + platform.id}
          onPress={() => Alert.alert(
            'Link RAWG metadata?',
            `${candidate.title} · ${platform.name}${candidate.releaseDate ? ' · ' + candidate.releaseDate : ''}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Link', onPress: () => onLink(candidate, platform) },
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
