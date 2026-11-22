
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

/**
 * @typedef {Object} GameMetadata
 * @property {string} title
 * @property {string} platform
 * @property {string} [coverUrl]
 * @property {string} [edition]
 * @property {string} [description]
 * @property {string} [releaseDate]
 * @property {string} [genre]
 * @property {string} [developer]
 * @property {string} [publisher]
 * @property {number} [metacriticScore] Critic score out of 100.
 * @property {number} [userScore] User score out of 10.
 * @property {string} [contentRating]
 * @property {string} [format]
 */

const METADATA_FIELDS = [
  ['edition', 'Edition'],
  ['releaseDate', 'Release date'],
  ['genre', 'Genre'],
  ['developer', 'Developer'],
  ['publisher', 'Publisher'],
  ['metacriticScore', 'Metacritic critic score', '/100'],
  ['userScore', 'User score', '/10'],
  ['contentRating', 'Content rating'],
  ['format', 'Format'],
];

/** @type {Array<GameMetadata & { id: string }>} */
const DISCOVER_GAMES = [
  ...SWITCH_TITLES.map(title => ({
    title, platform: 'Nintendo Switch',
  })),
  ...PS4_TITLES.map(title => ({
    title, platform: 'PlayStation 4',
  })),
  ...[
    'The Legend of Zelda: Breath of the Wild',
    'The Legend of Zelda: Tears of the Kingdom',
    'Super Mario Odyssey', 'Super Mario Bros. Wonder',
    'Super Smash Bros. Ultimate', 'Animal Crossing: New Horizons',
    'Xenoblade Chronicles: Definitive Edition',
    'Xenoblade Chronicles 2', 'Xenoblade Chronicles 3',
    'Fire Emblem: Three Houses', 'Astral Chain',
    'Bayonetta 3', 'Kirby and the Forgotten Land',
    'Luigi’s Mansion 3', 'Donkey Kong Country: Tropical Freeze',
  ].map(title => ({ title, platform: 'Nintendo Switch' })),
  ...[
    'Bloodborne', 'God of War', 'God of War Ragnarök',
    'Ghost of Tsushima', 'Horizon Zero Dawn',
    'Horizon Forbidden West', 'The Last of Us Part II',
    'Persona 5', 'Final Fantasy VII Remake',
    'Red Dead Redemption 2', 'Sekiro: Shadows Die Twice',
    'Elden Ring', 'Resident Evil 2',
  ].map(title => ({ title, platform: 'PlayStation 4' })),
  ...[
    'Astro Bot', 'Demon’s Souls', 'Returnal',
    'Marvel’s Spider-Man 2', 'Final Fantasy XVI',
    'Final Fantasy VII Rebirth', 'Ratchet & Clank: Rift Apart',
    'Stellar Blade', 'Death Stranding 2: On the Beach',
    'Elden Ring', 'Resident Evil 4',
  ].map(title => ({ title, platform: 'PlayStation 5' })),
  ...[
    'Super Mario 64', 'The Legend of Zelda: Ocarina of Time',
    'The Legend of Zelda: Majora’s Mask',
    'Banjo-Kazooie', 'Paper Mario', 'GoldenEye 007',
  ].map(title => ({ title, platform: 'Nintendo 64' })),
  ...[
    'Super Mario Sunshine', 'Metroid Prime',
    'The Legend of Zelda: The Wind Waker',
    'The Legend of Zelda: Twilight Princess',
    'Paper Mario: The Thousand-Year Door',
    'Luigi’s Mansion', 'Super Smash Bros. Melee',
  ].map(title => ({ title, platform: 'Nintendo GameCube' })),
  ...[
    'The Legend of Zelda: A Link Between Worlds',
    'Fire Emblem Awakening', 'Pokémon X',
    'Pokémon Alpha Sapphire', 'Super Mario 3D Land',
    'Kid Icarus: Uprising', 'Animal Crossing: New Leaf',
  ].map(title => ({ title, platform: 'Nintendo 3DS' })),
].map((game, index) => ({
  ...game,
  id: `catalog-${index}`,
}));

const CONSOLES = [
  'All Consoles', 'Nintendo Switch', 'PlayStation 4',
  'PlayStation 5', 'Nintendo 64',
  'Nintendo GameCube', 'Nintendo 3DS',
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

const normalizeGameText = value =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'").toLowerCase();

const sameGame = (a, b) =>
  normalizeGameText(a.title) === normalizeGameText(b.title) &&
  normalizeGameText(a.platform) === normalizeGameText(b.platform);

const hasMetadata = value =>
  (typeof value === 'string' && value.trim() !== '') ||
  Number.isFinite(value);

function resolveMetadata(game) {
  const catalogGame = DISCOVER_GAMES.find(item => sameGame(item, game));
  const metadata = { title: game.title, platform: game.platform };

  for (const field of ['coverUrl', 'description', ...METADATA_FIELDS.map(([key]) => key)]) {
    const value = hasMetadata(game[field]) ? game[field] : catalogGame?.[field];
    if (hasMetadata(value)) metadata[field] = value;
  }

  return metadata;
}

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
  onAddToWishlist, onRemoveFromWishlist, onAddToCollection,
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const [notes, setNotes] = useState(game.notes || '');
  const scrollRef = useRef(null);
  const notesPosition = useRef(0);

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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalShade}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={Keyboard.dismiss}
          />
          <ScrollView
            ref={scrollRef}
            style={{ width: '100%' }}
            contentContainerStyle={styles.detailScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.detail}>
              <View style={styles.detailTopBar}>
                <Text style={styles.detailEyebrow}>SHELFVAULT · GAME DETAILS</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close game details"
                  onPress={onClose}
                  style={styles.detailClose}
                >
                  <Text style={styles.detailCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.detailHero}>
                <Animated.View style={[
                  styles.case,
                  styles.detailHeroCase,
                  {
                    borderColor: platformColor(game.platform),
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
                  <View style={{
                    backgroundColor: platformColor(game.platform),
                    padding: 6,
                  }}>
                    <Text style={styles.detailCasePlatform} numberOfLines={1}>
                      {game.platform}
                    </Text>
                  </View>
                  {game.coverUrl && !coverFailed ? (
                    <Image
                      source={{ uri: game.coverUrl }}
                      style={{ flex: 1, width: '100%' }}
                      resizeMode="contain"
                      accessibilityLabel={'Cover artwork for ' + game.title}
                      onError={() => setCoverFailed(true)}
                    />
                  ) : (
                    <View style={styles.detailCaseFallback}>
                      <Text style={styles.detailCaseTitle} numberOfLines={5}>
                        {game.title}
                      </Text>
                      <Text style={styles.detailCaseMissing}>Cover unavailable</Text>
                    </View>
                  )}
                </Animated.View>
                <View style={styles.detailHeroInfo}>
                  <Text style={styles.detailTitle}>{game.title}</Text>
                  <Text style={styles.subheading}>{game.platform}</Text>
                  <Text style={styles.detailStatus}>
                    {source === 'collection' ? '✓ In Collection'
                      : source === 'wishlist' ? '♡ On Wishlist' : 'Discover'}
                  </Text>
                  {hasMetadata(game.genre) && (
                    <Text style={styles.subheading}>{game.genre}</Text>
                  )}
                  {hasMetadata(game.releaseDate) && (
                    <Text style={styles.subheading}>Released {game.releaseDate}</Text>
                  )}
                </View>
              </View>

              <View style={styles.detailDivider} />
              <Text style={styles.detailSectionTitle}>About this game</Text>
              <Text style={styles.detailBody}>
                {hasMetadata(game.description)
                  ? game.description : 'Description unavailable.'}
              </Text>

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
                  <Text style={styles.detailRatingLabel}>Metacritic</Text>
                </View>
                <View style={styles.detailRatingCard}>
                  <Text style={styles.detailRatingValue}>
                    {score(game.userScore, '/10')}
                  </Text>
                  <Text style={styles.detailRatingLabel}>User Score</Text>
                </View>
              </View>
              {(!Number.isFinite(game.metacriticScore) ||
                !Number.isFinite(game.userScore)) && (
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
                  <View style={styles.detailActions}>
                    {source === 'discover' ? (
                      <Button selected onPress={onAddToWishlist}>
                        ♡ Add to Wishlist
                      </Button>
                    ) : (
                      <Button onPress={onRemoveFromWishlist}>
                        Remove from Wishlist
                      </Button>
                    )}
                    <Button onPress={onAddToCollection}>
                      {source === 'wishlist'
                        ? 'Move to Collection' : '+ Add to Collection'}
                    </Button>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GameRow({ game, onPress }) {
  return (
    <Pressable accessibilityRole="button" style={styles.gameRow} onPress={onPress}>
      <View style={[
        styles.gameCover,
        { borderColor: platformColor(game.platform) },
      ]}>
        <Text style={{ color: '#fff', fontSize: 20 }}>▣</Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: C.text, fontWeight: '700' }}>
          {game.title}
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          {game.platform}
        </Text>
      </View>
    </Pressable>
  );
}

export default function App() {
  const [library, setLibrary] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState('collection');
  const [view, setView] = useState('shelf');
  const [detail, setDetail] = useState(null);
  const [moving, setMoving] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [entry, setEntry] = useState('');
  const [platform, setPlatform] = useState('Nintendo Switch');

  const [search, setSearch] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('All Consoles');
  const [discoverSort, setDiscoverSort] = useState('az');

  useEffect(() => {
    let active = true;
    (async () => {
      let savedLibrary = seed();
      let savedWishlist = [];

      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) savedLibrary = JSON.parse(raw);
      } catch (e) {
        console.warn('Could not load collection', e);
      }

      try {
        const raw = await AsyncStorage.getItem(WISHLIST_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) savedWishlist = parsed;
        }
      } catch (e) {
        console.warn('Could not load wishlist', e);
      }

      if (active) {
        setLibrary(savedLibrary);
        setWishlist(savedWishlist);
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

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

  const isWishlisted = game =>
    wishlist.some(g => sameGame(g, game));

  const addToWishlist = game => {
    if (isOwned(game)) return;

    setWishlist(old => old.some(g => sameGame(g, game))
      ? old
      : [...old, { ...resolveMetadata(game), id: uid() }]
    );
  };

  const removeFromWishlist = game =>
    setWishlist(old => old.filter(g => !sameGame(g, game)));

  const addToCollection = game => {
    const id = uid();
    const platformShelfId = uid();
    const savedGame = wishlist.find(item => sameGame(item, game));
    const metadata = resolveMetadata({ ...savedGame, ...game });
    update(l => {
      if (l.games.some(g => sameGame(g, game))) return l;

      const shelf = l.shelves.find(s =>
        normalizeGameText(s.name) === normalizeGameText(game.platform)
      );
      return {
        ...l,
        games: [...l.games, {
          ...metadata,
          id,
          owned: true,
          notes: '',
        }],
        shelves: shelf
          ? l.shelves.map(s =>
              s.id === shelf.id
                ? { ...s, ids: [...s.ids, id] }
                : s
            )
          : [
              ...l.shelves,
              { id: platformShelfId, name: game.platform, ids: [id] },
            ],
      };
    });

    removeFromWishlist(game);
  };

  const add = () => {
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
      addToCollection({ title: name, platform });
    }
    setDialog(null);
    setEntry('');
  };

  if (!ready || !library) {
    return (
      <SafeAreaView style={styles.app}>
        <Text style={styles.heading}>Loading ShelfVault...</Text>
      </SafeAreaView>
    );
  }

  const filteredDiscover = DISCOVER_GAMES.filter(game =>
    (consoleFilter === 'All Consoles' || game.platform === consoleFilter) &&
    game.title.toLowerCase().includes(search.trim().toLowerCase()) &&
    !isOwned(game) &&
    !isWishlisted(game)
  ).sort((a, b) =>
    discoverSort === 'za'
      ? b.title.localeCompare(a.title)
      : a.title.localeCompare(b.title)
  );

  const sortedWishlist = [...wishlist].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const openDetail = game => {
    Keyboard.dismiss();
    setDetail({ source: tab, game });
  };

  const detailGame = detail?.source === 'collection'
    ? library.games.find(g => g.id === detail.game.id)
    : detail?.game;

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
                        <View style={{
                          width: 5,
                          backgroundColor: platformColor(g.platform),
                          marginRight: 9,
                        }} />
                        <Text
                          style={{ color: '#fff', flex: 1 }}
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

      {tab === 'discover' && (
        <View style={{ flex: 1 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⌕ Discover</Text>
            <Text style={styles.subheading}>
              Explore games by console
            </Text>
          </View>

          <View style={{ paddingHorizontal: 12 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search games..."
              placeholderTextColor="#888"
              style={styles.input}
              returnKeyType="search"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginBottom: 10, flexGrow: 0 }}
            >
              {CONSOLES.map(consoleName => (
                <Button
                  key={consoleName}
                  selected={consoleFilter === consoleName}
                  onPress={() => {
                    Keyboard.dismiss();
                    setConsoleFilter(consoleName);
                  }}
                  style={{ marginRight: 7 }}
                >
                  {consoleName}
                </Button>
              ))}
            </ScrollView>

            <View style={{
              flexDirection: 'row',
              gap: 7,
              marginBottom: 8,
              alignItems: 'center',
            }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                Sort:
              </Text>
              <Button
                selected={discoverSort === 'az'}
                onPress={() => setDiscoverSort('az')}
              >
                A–Z
              </Button>
              <Button
                selected={discoverSort === 'za'}
                onPress={() => setDiscoverSort('za')}
              >
                Z–A
              </Button>
            </View>

            <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
              Popularity and review-score rankings coming with
              the live game database.
            </Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>
              {filteredDiscover.length} catalog results
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              padding: 12,
              paddingBottom: 20,
            }}
          >
            {filteredDiscover.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  No games found
                </Text>
                <Text style={styles.emptyDescription}>
                  Try another title or console.
                  This version uses a limited starter catalog.
                </Text>
              </View>
            ) : (
              filteredDiscover.map(game => (
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
          key={detail.source + ':' + detailGame.id}
          source={detail.source}
          game={{ ...detailGame, ...resolveMetadata(detailGame) }}
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
          onAddToWishlist={() => {
            addToWishlist(detailGame);
            setDetail(null);
          }}
          onRemoveFromWishlist={() => {
            removeFromWishlist(detailGame);
            setDetail(null);
          }}
          onAddToCollection={() => {
            addToCollection(detailGame);
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
              <View style={{
                flexDirection: 'row',
                gap: 6,
                flexWrap: 'wrap',
              }}>
                {[
                  'Nintendo Switch', 'PlayStation 4',
                  'PlayStation 5', 'Other',
                ].map(p => (
                  <Button
                    key={p}
                    selected={platform === p}
                    onPress={() => setPlatform(p)}
                  >
                    {p}
                  </Button>
                ))}
              </View>
            )}

            <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 14,
            }}>
              <Button onPress={() => setDialog(null)}>
                Cancel
              </Button>
              <Button selected onPress={add}>
                Create
              </Button>
            </View>
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
    flexDirection: 'row',
    padding: 8,
    borderRadius: 7,
  },
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
  gameCover: {
    width: 65,
    height: 88,
    backgroundColor: '#303141',
    borderWidth: 3,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detail: {
    backgroundColor: '#20212b',
    borderRadius: 22,
    padding: 17,
    width: '100%',
  },
  case: {
    height: 220,
    width: 158,
    backgroundColor: '#302e3c',
    borderWidth: 4,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 16,
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
  detailClose: { padding: 6 },
  detailCloseText: { color: C.text, fontSize: 26 },
  detailHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailHeroCase: {
    width: 112, height: 158, marginBottom: 0, alignSelf: 'flex-start',
  },
  detailHeroInfo: { flex: 1, paddingTop: 3 },
  detailCasePlatform: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  detailCaseFallback: {
    flex: 1, justifyContent: 'center', padding: 7,
  },
  detailCaseTitle: {
    color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 13,
  },
  detailCaseMissing: {
    color: C.muted, textAlign: 'center', fontSize: 9, marginTop: 9,
  },
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
