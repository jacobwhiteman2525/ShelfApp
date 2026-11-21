
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'shelfvault.expo.library.v1';

const SWITCH_TITLES = [
  'Mario Kart 8 Deluxe',
  'Mario Party Superstars',
  'Mario + Rabbids Kingdom Battle',
  'Mario + Rabbids Sparks of Hope',
  'Mario Strikers: Battle League',
  'Mario Tennis Aces',
  'Metroid Dread',
  'Metroid Prime Remastered',
  'Minecraft',
  'Monster Hunter Generations Ultimate',
  'MySims Cozy Bundle',
  'New Pokémon Snap',
  'Ni no Kuni: Wrath of the White Witch',
  'Nintendo World Championships',
  'Octopath Traveler',
  'Paper Mario: The Origami King',
  'Paper Mario: The Thousand-Year Door',
  'Persona 5 Royal',
  'Pikmin 1+2',
  'Pikmin 3 Deluxe',
  'Pikmin 4',
  'Pokémon Brilliant Diamond',
  'Pokémon Legends: Arceus',
  "Pokémon: Let's Go, Eevee!",
  'Pokémon Violet',
  'Princess Peach: Showtime!',
  'Ring Fit Adventure',
  'Rhythm Heaven Groove',
  'Sonic Mania',
];

const PS4_TITLES = [
  "JoJo's Bizarre Adventure: Eyes of Heaven",
  'The Witcher 3: Wild Hunt',
  'Uncharted: The Lost Legacy',
  "Uncharted 4: A Thief's End",
  'Uncharted: The Nathan Drake Collection',
  'Tunic',
  'Until Dawn',
  "Tom Clancy's The Division",
  'Tomb Raider: Definitive Edition',
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const seed = () => {
  const a = SWITCH_TITLES.map((title, i) => ({
    id: `switch-${i}`,
    title,
    platform: 'Nintendo Switch',
    notes: '',
    owned: true,
  }));

  const b = PS4_TITLES.map((title, i) => ({
    id: `ps4-${i}`,
    title,
    platform: 'PlayStation 4',
    notes: '',
    owned: true,
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
  bg: '#12131a',
  panel: '#22242f',
  text: '#f7f6fc',
  muted: '#b7b5c6',
  accent: '#a18aff',
  line: '#393747',
};

const platformColor = p =>
  p === 'Nintendo Switch'
    ? '#d82732'
    : p === 'PlayStation 4'
    ? '#1f4da6'
    : '#6555a0';

const spineColor = game =>
  game.platform === 'Nintendo Switch'
    ? '#db2733'
    : [
        '#e8d8ac',
        '#f1ca5b',
        '#272a33',
        '#303846',
        '#ece8df',
        '#66733d',
        '#242d42',
        '#dedede',
        '#8294a4',
      ][Math.max(0, Number(game.id.split('-').pop()) || 0) % 9];

const labelColor = hex =>
  ['#e8d8ac', '#f1ca5b', '#ece8df', '#dedede', '#8294a4'].includes(hex)
    ? '#1e2130'
    : '#fff';

function Button({ children, onPress, selected = false, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, selected && styles.buttonSelected, style]}
    >
      <Text style={[styles.buttonText, selected && { color: '#fff' }]}>
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
          transform: [
            {
              rotate: modern
                ? '0deg'
                : game.id.length % 3 === 0
                ? '1deg'
                : '0deg',
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.spineBrand,
          { backgroundColor: isSwitch ? '#bd1928' : '#1b4092' },
        ]}
      >
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
  shelf,
  games,
  theme,
  sort,
  onOpen,
  onMoveStart,
  moving,
  onMoveTo,
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
    <View
      style={[
        styles.shelfContainer,
        { backgroundColor: modern ? '#292c38' : '#33251e' },
      ]}
    >
      <View style={styles.shelfHeader}>
        <Text style={styles.shelfTitle}>
          {shelf.name === 'Nintendo Switch'
            ? '🔴 '
            : shelf.name === 'PlayStation 4'
            ? '🔵 '
            : '▣ '}
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
        {items.length ? (
          items.map(g => (
            <Spine
              key={g.id}
              game={g}
              modern={modern}
              onPress={() =>
                moving ? onMoveTo(shelf.id, g.id) : onOpen(g)
              }
              onLongPress={() => onMoveStart(g)}
            />
          ))
        ) : (
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

      <View
        style={[
          styles.woodLip,
          {
            backgroundColor: modern ? '#6c6d7d' : '#aa7a4a',
            borderBottomColor: modern ? '#4a4c5a' : '#6d482d',
          },
        ]}
      />
    </View>
  );
}

function Detail({ game, onClose, onSave, onAddToShelf, shelves }) {
  const slide = useRef(new Animated.Value(0)).current;
  const [notes, setNotes] = useState(game.notes || '');
  const scrollRef = useRef(null);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [slide]);

  const dismissKeyboard = () => Keyboard.dismiss();

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        dismissKeyboard();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalShade}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={dismissKeyboard}
            accessible={false}
          />

          <ScrollView
            ref={scrollRef}
            style={{ width: '100%' }}
            contentContainerStyle={styles.detailScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={false}
          >
            <View style={styles.detail}>
              <Pressable
                onPress={() => {
                  dismissKeyboard();
                  onClose();
                }}
                style={{
                  alignSelf: 'flex-end',
                  padding: 8,
                }}
              >
                <Text style={{ color: C.text, fontSize: 22 }}>×</Text>
              </Pressable>

              <Animated.View
                style={[
                  styles.case,
                  {
                    borderColor: platformColor(game.platform),
                    transform: [
                      {
                        translateY: slide.interpolate({
                          inputRange: [0, 1],
                          outputRange: [70, 0],
                        }),
                      },
                      {
                        scale: slide.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.75, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: platformColor(game.platform),
                    padding: 7,
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  >
                    {game.platform}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    padding: 15,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 26,
                      color: '#fff',
                      fontWeight: '900',
                      textAlign: 'center',
                    }}
                  >
                    {game.title}
                  </Text>

                  <Text
                    style={{
                      color: C.muted,
                      textAlign: 'center',
                      marginTop: 15,
                    }}
                  >
                    Cover placeholder
                  </Text>
                </View>
              </Animated.View>

              <Text style={styles.detailTitle}>{game.title}</Text>

              <Text style={styles.subheading}>
                {game.platform} · Physical · Owned
              </Text>

              <Text
                style={[
                  styles.subheading,
                  {
                    alignSelf: 'flex-start',
                    marginTop: 12,
                  },
                ]}
              >
                Notes
              </Text>

              <TextInput
                multiline={true}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes about this game..."
                placeholderTextColor="#888"
                style={[styles.input, styles.notesInput]}
                scrollEnabled={true}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit={true}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({
                      animated: true,
                    });
                  }, 300);
                }}
                onSubmitEditing={dismissKeyboard}
              />

              <Button
                onPress={() => {
                  dismissKeyboard();
                  onSave(game.id, notes);
                  onClose();
                }}
              >
                Save notes
              </Button>

              <Text
                style={[
                  styles.subheading,
                  {
                    alignSelf: 'flex-start',
                    marginTop: 12,
                  },
                ]}
              >
                Add to another shelf
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
                  >
                    {s.name}
                  </Button>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function App() {
  const [library, setLibrary] = useState(null);
  const [view, setView] = useState('shelf');
  const [detail, setDetail] = useState(null);
  const [moving, setMoving] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [entry, setEntry] = useState('');
  const [platform, setPlatform] = useState('Nintendo Switch');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORE_KEY);
        setLibrary(saved ? JSON.parse(saved) : seed());
      } catch (e) {
        setLibrary(seed());
      }
    })();
  }, []);

  useEffect(() => {
    if (library) {
      AsyncStorage.setItem(
        STORE_KEY,
        JSON.stringify(library)
      ).catch(() => {});
    }
  }, [library]);

  const update = fn => setLibrary(old => fn(old));

  const sortedGames = shelf => {
    let g = shelf.ids
      .map(id => library.games.find(x => x.id === id))
      .filter(Boolean);

    return library.sort === 'az'
      ? g.sort((a, b) => a.title.localeCompare(b.title))
      : library.sort === 'za'
      ? g.sort((a, b) => b.title.localeCompare(a.title))
      : g;
  };

  const moveTo = (shelfId, targetId) => {
    if (!moving) return;

    update(l => ({
      ...l,
      sort: 'custom',
      shelves: l.shelves.map(s => {
        if (s.id !== shelfId) return s;

        let ids = s.ids.filter(id => id !== moving.id);
        const idx = targetId ? ids.indexOf(targetId) : -1;

        if (idx < 0) {
          ids.push(moving.id);
        } else {
          ids.splice(idx, 0, moving.id);
        }

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
      const id = uid();

      update(l => {
        const game = {
          id,
          title: name,
          platform,
          owned: true,
          notes: '',
        };

        const shelf = l.shelves.find(s => s.name === platform);

        return {
          ...l,
          games: [...l.games, game],
          shelves: shelf
            ? l.shelves.map(s =>
                s.id === shelf.id
                  ? { ...s, ids: [...s.ids, id] }
                  : s
              )
            : [
                ...l.shelves,
                { id: uid(), name: platform, ids: [id] },
              ],
        };
      });
    }

    setDialog(null);
    setEntry('');
  };

  if (!library) {
    return (
      <SafeAreaView style={styles.app}>
        <Text style={styles.heading}>Loading ShelfVault...</Text>
      </SafeAreaView>
    );
  }

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
        <Button
          onPress={() =>
            update(l => ({
              ...l,
              theme: l.theme === 'wood' ? 'modern' : 'wood',
            }))
          }
        >
          {library.theme === 'wood' ? '🪵 Wood' : '▤ Modern'}
        </Button>

        <Button
          onPress={() =>
            update(l => ({
              ...l,
              sort:
                l.sort === 'custom'
                  ? 'az'
                  : l.sort === 'az'
                  ? 'za'
                  : 'custom',
            }))
          }
        >
          Sort:{' '}
          {library.sort === 'custom'
            ? 'Manual'
            : library.sort === 'az'
            ? 'A–Z'
            : 'Z–A'}
        </Button>

        <Button
          onPress={() => {
            setDialog('shelf');
            setEntry('');
          }}
        >
          + Shelf
        </Button>
      </View>

      {moving && (
        <View style={styles.moveBanner}>
          <Text style={{ color: '#fff', flex: 1 }}>
            Moving: {moving.title}. Tap a spine to insert before it,
            or + End.
          </Text>

          <Button onPress={() => setMoving(null)}>Cancel</Button>
        </View>
      )}

      {view === 'shelf' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
          {library.shelves.map(s => (
            <Shelf
              key={s.id}
              shelf={s}
              games={library.games}
              theme={library.theme}
              sort={library.sort}
              onOpen={setDetail}
              onMoveStart={setMoving}
              moving={moving}
              onMoveTo={moveTo}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 12,
            paddingBottom: 80,
          }}
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
                    onPress={() => setDetail(g)}
                    onLongPress={() => setMoving(g)}
                    style={
                      view === 'grid'
                        ? styles.gridCard
                        : styles.listCard
                    }
                  >
                    <View
                      style={{
                        width: 5,
                        backgroundColor: platformColor(g.platform),
                        marginRight: 9,
                      }}
                    />

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

      <View style={styles.bottom}>
        <Text style={styles.bottomActive}>
          ▥ Collection
        </Text>
        <Text style={styles.bottomMuted}>
          ♡ Wishlist (soon)
        </Text>
        <Text style={styles.bottomMuted}>
          ▤ Stats (soon)
        </Text>
      </View>

      {detail && (
        <Detail
          key={detail.id}
          game={
            library.games.find(g => g.id === detail.id) || detail
          }
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
              {dialog === 'shelf'
                ? 'New custom shelf'
                : 'Add a game'}
            </Text>

            <TextInput
              autoFocus
              value={entry}
              onChangeText={setEntry}
              placeholder={
                dialog === 'shelf' ? 'Shelf name' : 'Game title'
              }
              placeholderTextColor="#888"
              style={styles.input}
            />

            {dialog === 'game' && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  'Nintendo Switch',
                  'PlayStation 4',
                  'Other',
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

            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                marginTop: 14,
              }}
            >
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: '#1d1d27',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopColor: C.line,
    borderTopWidth: 1,
  },
  bottomActive: {
    color: C.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomMuted: {
    color: C.muted,
    fontSize: 11,
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
  addModal: {
    width: '100%',
    backgroundColor: '#22232d',
    padding: 20,
    borderRadius: 18,
    gap: 8,
  },
});
