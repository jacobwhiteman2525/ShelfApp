
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DiscoverScreen, { RawgAttribution } from './discovery/DiscoverScreen';
import { MetadataLink, useRawgDetails } from './discovery/detail';
import { fillMetadata, sameGame, selectPlatform } from './discovery/model';
import { collectGame, enrichSavedGame, linkSavedGame, readSavedRecords, savedGame } from './collectionRecords';
import GameArtwork, { CoverAttribution } from './discovery/GameArtwork';
import GameDescription from './discovery/GameDescription';

const STORE_KEY = 'shelfvault.expo.library.v1';
const WISHLIST_KEY = 'shelfvault.expo.wishlist.v1';

const SWITCH_TITLES = [
  'Mario Kart 8 Deluxe', 'Mario Party Superstars',
  'Mario + Rabbids Kingdom Battle', 'Mario + Rabbids Sparks of Hope',
  'Mario Strikers: Battle League', 'Mario Tennis Aces',
  'Metroid Dread', 'Metroid Prime Remastered', 'Minecraft',
  'Monster Hunter Generations Ultimate', 'MySims Cozy Bundle',
  'New Pokémon Snap', 'Ni no Kuni: Wrath of the White Witch',
  'Nintendo World Championships', 'Octopath Traveler',
  'Paper Mario: The Origami King',
  'Paper Mario: The Thousand-Year Door', 'Persona 5 Royal',
  'Pikmin 1+2', 'Pikmin 3 Deluxe', 'Pikmin 4',
  'Pokémon Brilliant Diamond', 'Pokémon Legends: Arceus',
  "Pokémon: Let's Go, Eevee!", 'Pokémon Violet',
  'Princess Peach: Showtime!', 'Ring Fit Adventure',
  'Rhythm Heaven Groove', 'Sonic Mania',
];

const PS4_TITLES = [
  "JoJo's Bizarre Adventure: Eyes of Heaven",
  'The Witcher 3: Wild Hunt', 'Uncharted: The Lost Legacy',
  "Uncharted 4: A Thief's End",
  'Uncharted: The Nathan Drake Collection',
  'Tunic', 'Until Dawn', "Tom Clancy's The Division",
  'Tomb Raider: Definitive Edition',
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const seed = () => {
  const a = SWITCH_TITLES.map((title, i) => ({
    id: `switch-${i}`, title, platform: 'Nintendo Switch',
    notes: '', owned: true,
  }));
  const b = PS4_TITLES.map((title, i) => ({
    id: `ps4-${i}`, title, platform: 'PlayStation 4',
    notes: '', owned: true,
  }));
  return {
    games: [...a, ...b],
    shelves: [
      { id: 'switch', name: 'Nintendo Switch', ids: a.map(g => g.id) },
      { id: 'ps4', name: 'PlayStation 4', ids: b.map(g => g.id) },
    ],
    theme: 'wood',
    sort: 'custom',
  };
};

const C = {
  bg: '#12131a', panel: '#22242f',
  text: '#f7f6fc', muted: '#b7b5c6',
  accent: '#a18aff', line: '#393747',
};

const platformColor = p =>
  p === 'Nintendo Switch' ? '#d82732'
  : p === 'PlayStation 4' ? '#1f4da6'
  : p === 'PlayStation 5' ? '#4265c9'
  : '#6555a0';

const spineColor = game =>
  game.platform === 'Nintendo Switch' ? '#db2733'
  : [
    '#e8d8ac', '#f1ca5b', '#272a33',
    '#303846', '#ece8df', '#66733d',
    '#242d42', '#dedede', '#8294a4',
  ][Math.max(0, Number(game.id.split('-').pop()) || 0) % 9];

const labelColor = hex =>
  ['#e8d8ac', '#f1ca5b', '#ece8df', '#dedede', '#8294a4']
    .includes(hex) ? '#1e2130' : '#fff';

const hasMetadata = value =>
  (typeof value === 'string' && value.trim() !== '') ||
  Number.isFinite(value);

function Button({ children, onPress, selected = false, style, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        selected && styles.buttonSelected,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={[
        styles.buttonText,
        selected && { color: '#fff' },
      ]}>
        {children}
      </Text>
    </Pressable>
  );
}

function Spine({ game, onPress, onLongPress, modern }) {
  const color = spineColor(game);
  const isSwitch = game.platform === 'Nintendo Switch';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        styles.spine,
        {
          backgroundColor: color,
          width: isSwitch ? 27 : 35,
          height: isSwitch ? 146 : 157,
          borderRadius: modern ? 2 : 4,
          transform: [{
            rotate: modern ? '0deg'
              : game.id.length % 3 === 0 ? '1deg' : '0deg',
          }],
        },
      ]}
    >
      <View style={[
        styles.spineBrand,
        { backgroundColor: isSwitch ? '#bd1928' : '#1b4092' },
      ]}>
        <Text style={styles.spineBrandText}>
          {isSwitch ? '◉' : 'PS4'}
        </Text>
      </View>
      <View style={styles.verticalHolder}>
        <Text
          numberOfLines={1}
          style={[
            styles.verticalText,
            {
              color: labelColor(color),
              width: isSwitch ? 112 : 122,
              fontSize: isSwitch ? 8 : 9,
            },
          ]}
        >
          {game.title.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.spineFoot, { color: labelColor(color) }]}>
        {isSwitch ? 'N' : 'PS'}
      </Text>
    </Pressable>
  );
}

function Shelf({
  shelf, games, theme, sort, onOpen,
  onMoveStart, moving, onMoveTo,
}) {
  const byId = new Map(games.map(g => [g.id, g]));
  let items = shelf.ids.map(id => byId.get(id)).filter(Boolean);

  if (sort === 'az') {
    items = [...items].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === 'za') {
    items = [...items].sort((a, b) => b.title.localeCompare(a.title));
  }

  const modern = theme === 'modern';

  return (
    <View style={[
      styles.shelfContainer,
      { backgroundColor: modern ? '#292c38' : '#33251e' },
    ]}>
      <View style={styles.shelfHeader}>
        <Text style={styles.shelfTitle}>
          {shelf.name === 'Nintendo Switch' ? '🔴 '
            : shelf.name === 'PlayStation 4' ? '🔵 ' : '▣ '}
          {shelf.name}
        </Text>
        <Text style={styles.count}>{items.length} games</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.spineRow,
          {
            minWidth: '100%',
            paddingHorizontal: 12,
            alignItems: 'flex-end',
          },
        ]}
      >
        {items.length ? items.map(g => (
          <Spine
            key={g.id}
            game={g}
            modern={modern}
            onPress={() =>
              moving ? onMoveTo(shelf.id, g.id) : onOpen(g)
            }
            onLongPress={() => onMoveStart(g)}
          />
        )) : (
          <Text style={{ color: C.muted, padding: 30 }}>
            Empty shelf · add a game from +
          </Text>
        )}
        {moving && (
          <Pressable
            onPress={() => onMoveTo(shelf.id, null)}
            style={styles.dropEnd}
          >
            <Text style={{ color: '#fff' }}>+ End</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={[
        styles.woodLip,
        {
          backgroundColor: modern ? '#6c6d7d' : '#aa7a4a',
          borderBottomColor: modern ? '#4a4c5a' : '#6d482d',
        },
      ]} />
    </View>
  );
}

function GameDetail({
  game, source, onClose, onSave, onAddToShelf, shelves,
  onAddToWishlist, onRemoveFromWishlist, onAddToCollection, onLink, onMetadata, onExplicitDetected,
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const [notes, setNotes] = useState(game.notes || '');
  const scrollRef = useRef(null);
  const notesPosition = useRef(0);
  const details = useRawgDetails(game.provider === 'rawg' ? game.providerId : undefined);
  const saveMetadata = useRef(onMetadata);
  saveMetadata.current = onMetadata;
  useEffect(() => {
    if (details.data) saveMetadata.current?.(details.data);
  }, [details.data]);
  const options = game.availablePlatforms || [];
  const [platformId, setPlatformId] = useState(options.length === 1 ? options[0].id : null);
  const option = options.find(item => item.id === platformId);
  game = fillMetadata(game, details.data);
  if (option) game = selectPlatform(game, option);
  const restricted = source === 'discover' && (game.discoveryIntent || 'safe') === 'safe' && game.explicitContent;
  const providerId = game.providerId;
  useEffect(() => {
    if (restricted) onExplicitDetected(providerId);
  }, [restricted, providerId, onExplicitDetected]);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [slide]);

  const info = [
    ['Release date', game.releaseDate],
    ['Genre', game.genre],
    ['Developer', game.developer],
    ['Publisher', game.publisher],
    ['Edition', game.edition],
    ['Content rating', game.contentRating],
    ['Format', game.format],
  ].filter(([, value]) => hasMetadata(value));

  const score = (value, suffix) =>
    Number.isFinite(value) ? `${value}${suffix}` : '—';

  const requestClose = () => {
    Keyboard.dismiss();

    if (source === 'collection' && notes !== (game.notes || '')) {
      Alert.alert(
        'Discard unsaved notes?',
        'Your Notes changes have not been saved.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
      return;
    }

    onClose();
  };

  if (restricted) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={requestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalShade}>
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
          />
          <ScrollView
            ref={scrollRef}
            style={{ width: '100%' }}
            contentContainerStyle={styles.detailScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Pressable
              accessible={false}
              style={styles.detailBackdropSpace}
              onPress={requestClose}
            />
            <View style={styles.detail}>
              <View style={styles.detailTopBar}>
                <Text style={styles.detailEyebrow}>SHELFVAULT · GAME DETAILS</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close game details"
                  onPress={requestClose}
                  style={styles.detailClose}
                >
                  <Text style={styles.detailCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.detailHero}>
                <Animated.View style={[
                  styles.detailHeroCase,
                  {
                    transform: [
                      {
                        translateY: slide.interpolate({
                          inputRange: [0, 1], outputRange: [50, 0],
                        }),
                      },
                      {
                        scale: slide.interpolate({
                          inputRange: [0, 1], outputRange: [0.85, 1],
                        }),
                      },
                    ],
                  },
                ]}>
                  <GameArtwork game={game} resolve={source !== 'discover' || !details.loading}
                    style={{ width: '100%', borderColor: platformColor(game.platform) }} />
                </Animated.View>
                <View style={styles.detailHeroInfo}>
                  <Text style={styles.detailTitle}>{game.title}</Text>
                  <Text style={styles.subheading}>
                    {game.platform || (options.length ? 'Multiple platforms' : 'Platform unavailable')}
                  </Text>
                  <Text style={styles.detailStatus}>
                    {source === 'collection' ? '✓ In Collection'
                      : source === 'wishlist' ? '♡ On Wishlist' : 'Discover'}
                  </Text>
                  {game.explicitContent && <Text style={styles.subheading}>Explicit sexual content</Text>}
                  {hasMetadata(game.genre) && (
                    <Text style={styles.subheading}>{game.genre}</Text>
                  )}
                  {hasMetadata(game.releaseDate) && (
                    <Text style={styles.subheading}>Released {game.releaseDate}</Text>
                  )}
                </View>
              </View>

              <View style={styles.detailDivider} />
              {game.provider === 'rawg' ? (
                <>
                  {details.loading && <Text style={styles.subheading}>Loading game metadata…</Text>}
                  {!!details.message && (
                    <>
                      <Text style={styles.subheading}>{details.message}</Text>
                      <Button onPress={details.retry}>Retry metadata</Button>
                    </>
                  )}
                </>
              ) : onLink && <MetadataLink game={game} Button={Button}
                textStyle={styles.subheading} onLink={onLink} />}
              <Text style={styles.detailSectionTitle}>About this game</Text>
              <GameDescription style={styles.detailBody}
                description={hasMetadata(game.description) ? game.description : 'Description unavailable.'} />

              {info.length > 0 && (
                <View style={styles.detailInfoGrid}>
                  {info.map(([label, value]) => (
                    <View key={label} style={styles.detailInfoCell}>
                      <Text style={styles.detailInfoLabel}>{label}</Text>
                      <Text style={styles.detailInfoValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.detailDivider} />
              <Text style={styles.detailSectionTitle}>Ratings</Text>
              <View style={styles.detailRatingsRow}>
                <View style={styles.detailRatingCard}>
                  <Text style={styles.detailRatingValue}>
                    {score(game.metacriticScore, '/100')}
                  </Text>
                  <Text style={styles.detailRatingLabel}>Metacritic critic score</Text>
                </View>
                <View style={styles.detailRatingCard}>
                  <Text style={styles.detailRatingValue}>
                    {game.provider === 'rawg' ? score(game.rawgRating, '/5') : score(game.userScore, '/10')}
                  </Text>
                  <Text style={styles.detailRatingLabel}>
                    {game.provider === 'rawg' ? 'RAWG community rating' : 'User Score'}
                  </Text>
                  {Number.isInteger(game.rawgRatingsCount) && <Text style={styles.detailRatingLabel}>
                    {game.rawgRatingsCount.toLocaleString()} ratings
                  </Text>}
                </View>
              </View>
              {game.provider === 'rawg' && Number.isFinite(game.userScore) && (
                <Text style={styles.detailInfoLabel}>User score {score(game.userScore, '/10')}</Text>
              )}
              {(!Number.isFinite(game.metacriticScore) ||
                !Number.isFinite(game.provider === 'rawg' ? game.rawgRating : game.userScore)) && (
                <Text style={styles.detailInfoLabel}>
                  Missing scores will appear when metadata is available.
                </Text>
              )}

              {source === 'collection' ? (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailCollectionHeading}>
                    <Text style={styles.detailSectionTitle}>My Collection</Text>
                    <Text style={styles.detailStatus}>
                      {game.owned === true ? 'Owned'
                        : game.owned === false ? 'Not owned' : 'Status unavailable'}
                    </Text>
                  </View>
                  <Text style={styles.detailFieldTitle}>Personal Notes</Text>
                  <View onLayout={event => {
                    notesPosition.current = event.nativeEvent.layout.y;
                  }}>
                    <TextInput
                      multiline
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add notes about this game..."
                      placeholderTextColor="#888"
                      style={[styles.input, styles.notesInput]}
                      scrollEnabled
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit
                      onFocus={() => {
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({
                            y: Math.max(0, notesPosition.current - 100),
                            animated: true,
                          });
                        }, 300);
                      }}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                  <Button selected onPress={() => {
                    Keyboard.dismiss();
                    onSave(game.id, notes);
                    onClose();
                  }}>Save Notes</Button>

                  <Text style={[styles.detailFieldTitle, { marginTop: 18 }]}>
                    Manage Shelves
                  </Text>
                  <ScrollView
                    horizontal
                    style={{ maxHeight: 48 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {shelves.map(s => (
                      <Button
                        key={s.id}
                        onPress={() => onAddToShelf(game.id, s.id)}
                        style={{ marginRight: 7 }}
                      >{s.name}</Button>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  <View style={styles.detailDivider} />
                  {source === 'discover' && options.length > 1 && (
                    <>
                      <Text style={styles.detailSectionTitle}>Choose a platform</Text>
                      <View style={styles.detailActions}>
                        {options.map(item => (
                          <Button key={item.id} selected={platformId === item.id}
                            onPress={() => setPlatformId(item.id)}>{item.name}</Button>
                        ))}
                      </View>
                    </>
                  )}
                  {source === 'discover' && options.length === 0 && (
                    <Text style={styles.subheading}>Use manual entry to save a game without a listed platform.</Text>
                  )}
                  <View style={styles.detailActions}>
                    {source === 'discover' ? (
                      <Button selected disabled={!option} onPress={() => onAddToWishlist(game)}>
                        ♡ Add to Wishlist
                      </Button>
                    ) : (
                      <Button onPress={onRemoveFromWishlist}>
                        Remove from Wishlist
                      </Button>
                    )}
                    <Button disabled={source === 'discover' && !option} onPress={() => onAddToCollection(game)}>
                      {source === 'wishlist'
                        ? 'Move to Collection' : '+ Add to Collection'}
                    </Button>
                  </View>
                </>
              )}
              <View style={styles.detailSources}>
                <Text style={styles.detailInfoLabel}>Game data sources</Text>
                <RawgAttribution compact />
                <CoverAttribution compact />
              </View>
            </View>
            <Pressable
              accessible={false}
              style={styles.detailBackdropSpace}
              onPress={requestClose}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GameRow({ game, onPress, summary }) {
  return (
    <Pressable accessibilityRole="button" style={styles.gameRow} onPress={onPress}>
      <GameArtwork game={game} compact style={{ width: 46, borderColor: platformColor(game.platform) }} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: C.text, fontWeight: '700' }}>
          {game.title}
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          {game.platform || (game.availablePlatforms?.length ? 'Multiple platforms' : 'Platform unavailable')}
        </Text>
        {!!summary && <Text style={styles.subheading}>{summary}</Text>}
        {game.explicitContent && <Text style={styles.subheading}>Explicit sexual content</Text>}
      </View>
    </Pressable>
  );
}

export default function App() {
  const [library, setLibrary] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [tab, setTab] = useState('collection');
  const [visitedDiscover, setVisitedDiscover] = useState(false);
  const [classifiedIds, setClassifiedIds] = useState(() => new Set());
  const [view, setView] = useState('shelf');
  const [detail, setDetail] = useState(null);
  const [moving, setMoving] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [entry, setEntry] = useState('');
  const [platform, setPlatform] = useState('Nintendo Switch');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = new Map(await AsyncStorage.multiGet([STORE_KEY, WISHLIST_KEY]));
        const saved = readSavedRecords(stored.get(STORE_KEY), stored.get(WISHLIST_KEY), seed);
        if (active) {
          setLibrary(saved.library);
          setWishlist(saved.wishlist);
          setReady(true);
        }
      } catch {
        if (active) setStorageError(true);
      }
    })();
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (ready && library) {
      AsyncStorage.multiSet([
        [STORE_KEY, JSON.stringify(library)],
        [WISHLIST_KEY, JSON.stringify(wishlist)],
      ]).catch(console.warn);
    }
  }, [library, wishlist, ready]);

  const update = fn => setLibrary(old => fn(old));

  const sortedGames = shelf => {
    let games = shelf.ids
      .map(id => library.games.find(g => g.id === id))
      .filter(Boolean);

    if (library.sort === 'az') {
      games.sort((a, b) => a.title.localeCompare(b.title));
    } else if (library.sort === 'za') {
      games.sort((a, b) => b.title.localeCompare(a.title));
    }
    return games;
  };

  const moveTo = (shelfId, targetId) => {
    if (!moving) return;
    update(l => ({
      ...l,
      sort: 'custom',
      shelves: l.shelves.map(s => {
        if (s.id !== shelfId) return s;
        const ids = s.ids.filter(id => id !== moving.id);
        const idx = targetId ? ids.indexOf(targetId) : -1;
        if (idx < 0) ids.push(moving.id);
        else ids.splice(idx, 0, moving.id);
        return { ...s, ids };
      }),
    }));
    setMoving(null);
  };

  const addMembership = (gameId, shelfId) =>
    update(l => ({
      ...l,
      shelves: l.shelves.map(s =>
        s.id === shelfId && !s.ids.includes(gameId)
          ? { ...s, ids: [...s.ids, gameId] }
          : s
      ),
    }));

  const isOwned = game =>
    library.games.some(g => sameGame(g, game));

  const addToWishlist = game => {
    if (isOwned(game)) return;

    setWishlist(old => old.some(g => sameGame(g, game))
      ? old
      : [...old, { ...savedGame(game), id: uid() }]
    );
  };

  const removeFromWishlist = game =>
    setWishlist(old => old.filter(g => g.id !== game.id));

  const addToCollection = game => {
    const id = uid();
    const platformShelfId = uid();
    const wish = wishlist.find(item => item.id === game.id) ||
      wishlist.find(item => sameGame(item, game));
    update(l => collectGame(l, game, wish, id, platformShelfId));
    if (wish) removeFromWishlist(wish);
  };

  const add = (toWishlist = false) => {
    const name = entry.trim();
    if (!name) return;

    if (dialog === 'shelf') {
      update(l => ({
        ...l,
        shelves: [
          ...l.shelves,
          { id: uid(), name, ids: [] },
        ],
      }));
    } else {
      const game = { title: name, platform: platform.trim() };
      if (!game.platform) return;
      if (toWishlist) addToWishlist(game);
      else addToCollection(game);
    }
    setDialog(null);
    setEntry('');
  };

  if (!ready || !library) {
    return (
      <SafeAreaView style={styles.app}>
        <Text style={styles.heading}>
          {storageError ? 'Could not read your saved ShelfVault data' : 'Loading ShelfVault…'}
        </Text>
        {storageError && <Button onPress={() => {
          setStorageError(false);
          setLoadAttempt(value => value + 1);
        }}>Retry</Button>}
      </SafeAreaView>
    );
  }

  const sortedWishlist = [...wishlist].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const openDetail = game => {
    Keyboard.dismiss();
    setDetail({ source: tab, game });
  };

  const detailGame = detail?.source === 'collection'
    ? library.games.find(g => g.id === detail.game.id)
    : detail?.source === 'wishlist' ? wishlist.find(g => g.id === detail.game.id) : detail?.game;

  const linkGame = (candidate, platform) => {
    const collection = detail.source === 'collection';
    const records = collection ? library.games : wishlist;
    const other = collection ? wishlist : library.games;
    const apply = games => linkSavedGame(games, other, detailGame.id, candidate, platform);
    if (apply(records) === records) return false;
    if (collection) update(old => ({ ...old, games: apply(old.games) }));
    else setWishlist(apply);
    return true;
  };

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" />

      <View style={styles.top}>
        <Text style={styles.heading}>▥ ShelfVault</Text>
        <Pressable
          onPress={() => {
            setDialog('game');
            setEntry('');
          }}
          style={styles.plus}
        >
          <Text style={{ color: '#fff', fontSize: 26 }}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.tagline}>
        Your collection, on your shelves.
      </Text>

      {tab === 'collection' && (
        <>
          {library.games.some(game => game.provider === 'rawg') && <RawgAttribution />}
          {view !== 'shelf' && <CoverAttribution />}
          <View style={styles.tabs}>
            {['shelf', 'grid', 'list'].map(v => (
              <Button
                key={v}
                selected={view === v}
                onPress={() => {
                  setMoving(null);
                  setView(v);
                }}
                style={{ flex: 1 }}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </View>

          <View style={styles.toolbar}>
            <Button onPress={() =>
              update(l => ({
                ...l,
                theme: l.theme === 'wood' ? 'modern' : 'wood',
              }))
            }>
              {library.theme === 'wood' ? '🪵 Wood' : '▤ Modern'}
            </Button>

            <Button onPress={() =>
              update(l => ({
                ...l,
                sort: l.sort === 'custom' ? 'az'
                  : l.sort === 'az' ? 'za' : 'custom',
              }))
            }>
              Sort: {library.sort === 'custom' ? 'Manual'
                : library.sort === 'az' ? 'A–Z' : 'Z–A'}
            </Button>

            <Button onPress={() => {
              setDialog('shelf');
              setEntry('');
            }}>
              + Shelf
            </Button>
          </View>

          {moving && (
            <View style={styles.moveBanner}>
              <Text style={{ color: '#fff', flex: 1 }}>
                Moving: {moving.title}. Tap a spine to insert
                before it, or + End.
              </Text>
              <Button onPress={() => setMoving(null)}>Cancel</Button>
            </View>
          )}

          {view === 'shelf' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {library.shelves.map(s => (
                <Shelf
                  key={s.id}
                  shelf={s}
                  games={library.games}
                  theme={library.theme}
                  sort={library.sort}
                  onOpen={openDetail}
                  onMoveStart={setMoving}
                  moving={moving}
                  onMoveTo={moveTo}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12 }}
            >
              {library.shelves.map(s => (
                <View key={s.id} style={{ marginBottom: 18 }}>
                  <Text style={styles.shelfTitle}>
                    {s.name} · {s.ids.length}
                  </Text>
                  <View style={view === 'grid' ? styles.grid : {}}>
                    {sortedGames(s).map(g => (
                      <Pressable
                        key={g.id}
                        onPress={() => openDetail(g)}
                        onLongPress={() => setMoving(g)}
                        style={view === 'grid'
                          ? styles.gridCard : styles.listCard}
                      >
                        <GameArtwork game={g} compact style={{
                          width: view === 'grid' ? 48 : 32,
                          borderColor: platformColor(g.platform),
                          alignSelf: view === 'grid' ? 'center' : 'flex-start',
                          marginRight: view === 'grid' ? 0 : 9,
                        }} />
                        <Text
                          style={view === 'grid' ? styles.gridGameTitle : styles.listGameTitle}
                          numberOfLines={view === 'grid' ? 3 : 1}
                        >
                          {g.title}
                        </Text>
                        {moving && (
                          <Text
                            onPress={() => moveTo(s.id, g.id)}
                            style={{ color: C.accent }}
                          >
                            Move here
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {tab === 'wishlist' && (
        <View style={{ flex: 1 }}>
          {wishlist.some(game => game.provider === 'rawg') && <RawgAttribution />}
          <CoverAttribution />
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>♡ Wishlist</Text>
            <Text style={styles.subheading}>
              {wishlist.length} games saved
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          >
            {sortedWishlist.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 36 }}>♡</Text>
                <Text style={styles.emptyTitle}>
                  Your wishlist is empty
                </Text>
                <Text style={styles.emptyDescription}>
                  Browse games in Discover and save the ones
                  you'd like to own.
                </Text>
                <Button
                  selected
                  onPress={() => setTab('discover')}
                >
                  Explore games
                </Button>
              </View>
            ) : (
              sortedWishlist.map(game => (
                <GameRow
                  key={game.id}
                  game={game}
                  onPress={() => openDetail(game)}
                />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {visitedDiscover && (
        <View style={{ flex: 1, display: tab === 'discover' ? 'flex' : 'none' }}>
          <DiscoverScreen
            Button={Button}
            GameRow={GameRow}
            tracked={[...library.games, ...wishlist]}
            classifiedIds={classifiedIds}
            onOpen={openDetail}
            onManualAdd={() => {
              Keyboard.dismiss();
              setEntry('');
              setDialog('game');
            }}
          />
        </View>
      )}

      <View style={styles.bottom}>
        {[
          ['collection', '▥', 'Collection'],
          ['wishlist', '♡', 'Wishlist'],
          ['discover', '⌕', 'Discover'],
        ].map(([key, symbol, name]) => (
          <Pressable
            key={key}
            onPress={() => {
              Keyboard.dismiss();
              setMoving(null);
              if (key === 'discover') setVisitedDiscover(true);
              setTab(key);
            }}
            style={styles.bottomTab}
          >
            <Text style={[
              styles.bottomIcon,
              { color: tab === key ? C.accent : C.muted },
            ]}>
              {symbol}
            </Text>
            <Text style={[
              styles.bottomText,
              { color: tab === key ? C.accent : C.muted },
            ]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      {detailGame && (
        <GameDetail
          key={detail.source + ':' + (detailGame.id || detailGame.providerId)}
          source={detail.source}
          game={detailGame}
          onExplicitDetected={id => {
            setClassifiedIds(old => new Set([...old, id]));
            setDetail(null);
          }}
          shelves={library.shelves}
          onClose={() => setDetail(null)}
          onSave={(id, notes) =>
            update(l => ({
              ...l,
              games: l.games.map(g =>
                g.id === id ? { ...g, notes } : g
              ),
            }))
          }
          onAddToShelf={addMembership}
          onLink={detail.source !== 'discover' ? linkGame : undefined}
          onMetadata={detail.source === 'discover' ? undefined : metadata => {
            const apply = games => enrichSavedGame(games, detailGame.id, metadata);
            if (detail.source === 'collection') update(old => {
              const games = apply(old.games);
              return games === old.games ? old : { ...old, games };
            });
            else setWishlist(apply);
          }}
          onAddToWishlist={game => {
            addToWishlist(game);
            setDetail(null);
          }}
          onRemoveFromWishlist={() => {
            removeFromWishlist(detailGame);
            setDetail(null);
          }}
          onAddToCollection={game => {
            addToCollection(game);
            setDetail(null);
          }}
        />
      )}

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalShade}
        >
          <View style={styles.addModal}>
            <Text style={styles.detailTitle}>
              {dialog === 'shelf' ? 'New custom shelf' : 'Add a game'}
            </Text>

            <TextInput
              autoFocus
              value={entry}
              onChangeText={setEntry}
              placeholder={dialog === 'shelf'
                ? 'Shelf name' : 'Game title'}
              placeholderTextColor="#888"
              style={styles.input}
            />

            {dialog === 'game' && (
              <>
                <TextInput
                  accessibilityLabel="Platform"
                  value={platform}
                  onChangeText={setPlatform}
                  placeholder="Platform"
                  placeholderTextColor="#888"
                  style={styles.input}
                />
                <View style={styles.detailActions}>
                  {['Nintendo Switch', 'PlayStation 4', 'PlayStation 5', 'Other'].map(option => (
                    <Button key={option} selected={platform === option}
                      onPress={() => setPlatform(option)}>{option}</Button>
                  ))}
                </View>
              </>
            )}

            <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 14,
            }}>
              <Button onPress={() => setDialog(null)}>
                Cancel
              </Button>
              <Button selected onPress={() => add()} disabled={!entry.trim() || (dialog === 'game' && !platform.trim())}>
                {dialog === 'shelf' ? 'Create' : 'Add to Collection'}
              </Button>
            </View>
            {dialog === 'game' && <Button onPress={() => add(true)} disabled={!entry.trim() || !platform.trim()}>
              Add to Wishlist
            </Button>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
  },
  plus: {
    backgroundColor: C.panel,
    width: 42,
    height: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    color: C.muted,
    paddingHorizontal: 18,
    marginTop: 3,
    marginBottom: 14,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    gap: 6,
  },
  button: {
    backgroundColor: C.panel,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: '#6e59d6',
  },
  buttonText: {
    color: C.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    marginVertical: 12,
    justifyContent: 'space-between',
  },
  shelfContainer: {
    marginBottom: 14,
    paddingTop: 12,
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  shelfTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  count: {
    color: '#d1c8c4',
    fontSize: 12,
  },
  spineRow: {
    height: 170,
    gap: 2,
  },
  spine: {
    borderWidth: 1,
    borderColor: '#ffffff35',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 5,
  },
  spineBrand: {
    height: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spineBrandText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  verticalHolder: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalText: {
    transform: [{ rotate: '90deg' }],
    fontWeight: '800',
    textAlign: 'center',
  },
  spineFoot: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  woodLip: {
    height: 14,
    borderBottomWidth: 5,
  },
  dropEnd: {
    height: 145,
    width: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: C.accent,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  moveBanner: {
    backgroundColor: '#4c3c82',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
  },
  gridCard: {
    width: '31%',
    minHeight: 130,
    backgroundColor: C.panel,
    gap: 6,
    padding: 8,
    borderRadius: 7,
  },
  gridGameTitle: { color: '#fff', textAlign: 'center' },
  listGameTitle: { color: '#fff', flex: 1 },
  listCard: {
    flexDirection: 'row',
    backgroundColor: C.panel,
    marginTop: 6,
    padding: 12,
    borderRadius: 7,
  },
  bottom: {
    height: 62,
    backgroundColor: '#1d1d27',
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: C.line,
    borderTopWidth: 1,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  bottomIcon: {
    fontSize: 23,
    fontWeight: 'bold',
  },
  bottomText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  gameRow: {
    backgroundColor: C.panel,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 9,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
    marginTop: 40,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDescription: {
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  modalShade: {
    flex: 1,
    backgroundColor: '#000b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailScrollContent: {
    flexGrow: 1,
  },
  detailBackdropSpace: {
    flexGrow: 1,
    minHeight: 12,
  },
  detail: {
    backgroundColor: '#20212b',
    borderRadius: 22,
    padding: 17,
    width: '100%',
  },
  detailTitle: {
    fontSize: 21,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 7,
  },
  subheading: {
    color: C.muted,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#11121b',
    color: '#fff',
    padding: 12,
    borderRadius: 9,
    borderColor: C.line,
    borderWidth: 1,
    marginVertical: 8,
    width: '100%',
  },
  notesInput: {
    minHeight: 100,
    maxHeight: 180,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
  },
  detailTopBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  detailEyebrow: {
    color: '#c4b2ff', fontSize: 10, fontWeight: '800',
    letterSpacing: 1, flexShrink: 1,
  },
  detailClose: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  detailCloseText: { color: C.text, fontSize: 26 },
  detailHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailHeroCase: { width: '48%', alignSelf: 'flex-start' },
  detailHeroInfo: { flex: 1, minWidth: 0, paddingTop: 3 },
  detailSources: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 18 },
  detailStatus: { color: '#9ddbbb', fontSize: 12, marginBottom: 7 },
  detailDivider: {
    height: 1, backgroundColor: C.line, marginVertical: 18,
  },
  detailSectionTitle: {
    color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 10,
  },
  detailBody: { color: '#d2d2de', fontSize: 14, lineHeight: 21 },
  detailInfoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 14,
  },
  detailInfoCell: { width: '50%', paddingRight: 10 },
  detailInfoLabel: { color: '#9999ad', fontSize: 11, marginBottom: 4 },
  detailInfoValue: { color: C.text, fontSize: 13, lineHeight: 18 },
  detailRatingsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  detailRatingCard: {
    flex: 1, backgroundColor: '#292b3a', padding: 14,
    borderRadius: 11, alignItems: 'center',
  },
  detailRatingValue: { color: C.text, fontSize: 22, fontWeight: '800' },
  detailRatingLabel: { color: C.muted, fontSize: 11, marginTop: 4 },
  detailCollectionHeading: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap',
  },
  detailFieldTitle: {
    color: '#d2d2de', fontWeight: '700', fontSize: 13, marginTop: 6,
  },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addModal: {
    width: '100%',
    backgroundColor: '#22232d',
    padding: 20,
    borderRadius: 18,
    gap: 8,
  },
});
