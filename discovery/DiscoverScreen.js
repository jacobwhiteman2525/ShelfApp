import React, { useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { availablePlatforms } from './model';
import { discoveryIntent, permitsGame } from './contentPolicy';
import { CoverAttribution } from './GameArtwork';
import { ArtworkViewport } from './ArtworkViewport';
import { gameQuery, SECTIONS, SORTS } from './queries';
import { useDebouncedSearch, useDiscovery, usePlatforms } from './useDiscovery';

export function RawgAttribution({ compact = false }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://rawg.io/').catch(() => {})}>
      <Text style={styles.link}>{compact ? 'RAWG' : 'Game data by RAWG'}</Text>
    </Pressable>
  );
}

export default function DiscoverScreen({ Button, GameRow, tracked, classifiedIds, onOpen, onManualAdd, active }) {
  const [input, setInput] = useState('');
  const [exact, setExact] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [section, setSection] = useState('popular');
  const [sort, setSort] = useState('popular');
  const search = useDebouncedSearch(input.trim());
  const typing = input.trim() !== search;
  const intent = discoveryIntent(search, exact);
  const filters = { ...gameQuery({ section, sort, search, platform: platform?.id }), intent };
  const results = useDiscovery(typing ? null : filters);
  const platforms = usePlatforms();
  const rows = typing ? [] : results.games.flatMap(game => {
    if (classifiedIds.has(game.providerId)) game = { ...game, explicitContent: true };
    if (!permitsGame(game, search, intent)) return [];
    if (section === 'upcoming' && !game.releaseDate) return [];
    const eligible = availablePlatforms(game, tracked)
      .filter(option => !platform || option.id === platform.id);
    if ((game.platforms.length || platform) && !eligible.length) return [];
    return [{
      ...game, availablePlatforms: eligible,
      discoveryIntent: intent,
      platform: eligible.length === 1 ? eligible[0].name : undefined,
    }];
  });
  const modes = section === 'upcoming' ? ['upcoming'] : section === 'new'
    ? ['new'] : ['popular', 'top', 'critic'];

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Discover</Text>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="Search games"
          value={input}
          onChangeText={value => { setExact(false); setInput(value); }}
          maxLength={120}
          placeholder="Search games"
          placeholderTextColor="#b7b5c6"
          returnKeyType="search"
          style={styles.input}
        />
        {!!input && <Button onPress={() => { setExact(false); setInput(''); }}>Clear</Button>}
      </View>
      <ArtworkViewport
        component={FlatList}
        active={active}
        key={JSON.stringify([section, sort, search, platform?.id, intent])}
        data={rows}
        keyExtractor={game => String(game.providerId)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          const summary = sort === 'top' ? (item.rawgRating == null ? 'RAWG rating unavailable' : `RAWG ${item.rawgRating}/5`)
            : sort === 'critic' ? (item.metacriticScore == null ? 'Metacritic score unavailable' : `Metacritic ${item.metacriticScore}/100`)
              : item.releaseDate;
          return <GameRow game={item} summary={summary} onPress={() => onOpen(item)} />;
        }}
        ListHeaderComponent={
          <View style={styles.controls}>
            {!!input.trim() && (
              <Button selected={exact} onPress={() => { Keyboard.dismiss(); setExact(value => !value); }}>
                Search exact title
              </Button>
            )}
            <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
              {SECTIONS.map(([id, label]) => (
                <Button key={id} selected={section === id} onPress={() => {
                  Keyboard.dismiss();
                  setSection(id);
                  setSort(id);
                }}>{label}</Button>
              ))}
            </ScrollView>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
              {modes.map(id => (
                <Button key={id} selected={sort === id} onPress={() => setSort(id)}>{SORTS[id][1]}</Button>
              ))}
            </ScrollView>
            <View style={styles.row}>
              <Button onPress={() => { Keyboard.dismiss(); setShowPlatforms(value => !value); }}>
                {platform?.name || 'All platforms'}
              </Button>
              <Button onPress={onManualAdd}>Add manually</Button>
            </View>
            {showPlatforms && (
              <>
                <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
                  <Button selected={!platform} onPress={() => { setPlatform(null); setShowPlatforms(false); }}>
                    All platforms
                  </Button>
                  {platforms.platforms.map(option => (
                    <Button key={option.id} selected={option.id === platform?.id} onPress={() => {
                      setPlatform(option);
                      setShowPlatforms(false);
                    }}>{option.name}</Button>
                  ))}
                </ScrollView>
                {platforms.loading && <ActivityIndicator accessibilityLabel="Loading platforms" />}
                {!!platforms.error && (
                  <>
                    <Text style={styles.muted}>{platforms.error}</Text>
                    <Button onPress={platforms.retry}>Retry platforms</Button>
                  </>
                )}
              </>
            )}
            <RawgAttribution />
            <CoverAttribution />
            {section === 'upcoming' && (
              <Text style={styles.muted}>Dated releases in the next 12 months. TBA releases are excluded.</Text>
            )}
            {(sort === 'top' || sort === 'critic') && (
              <Text style={styles.muted}>RAWG orders the results. Unscored games may appear, and ties follow RAWG’s order.</Text>
            )}
            {!typing && !!(results.error || results.warning || results.cached) && (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.muted}>
                  {results.error || (results.warning ? `Showing saved results. ${results.warning}`
                    : 'Showing cached results.')}
                </Text>
                <Button disabled={results.loading} onPress={results.retry}>
                  {results.error || results.warning ? 'Retry' : 'Refresh'}
                </Button>
              </>
            )}
          </View>
        }
        ListEmptyComponent={!typing && !results.loading && !results.error && (
          <Text style={styles.muted}>No untracked games on these pages. Try another search or platform.</Text>
        )}
        ListFooterComponent={typing || results.loading
          ? <ActivityIndicator style={styles.loading} accessibilityLabel="Loading games" />
          : results.hasMore && !results.error
            ? <Button style={styles.loading} onPress={results.more}>Load More</Button> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 12 },
  heading: { color: '#f7f6fc', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  controls: { gap: 7, paddingVertical: 8, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: { flex: 1, backgroundColor: '#22242f', color: '#f7f6fc', padding: 11, borderRadius: 10 },
  muted: { color: '#b7b5c6', fontSize: 12 },
  link: { color: '#c8baff', textDecorationLine: 'underline', paddingVertical: 5 },
  loading: { alignSelf: 'center', marginVertical: 10 },
});
