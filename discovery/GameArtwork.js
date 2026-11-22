import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { artworkCache, artworkPath } from './client';

const listeners = new Map();

function useCover(game, resolve) {
  const path = game.title && game.platform && !game.coverArtUrl
    ? artworkPath(game.title, game.platform) : null;
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const receive = data => {
      if (active && data?.coverArtUrl) setResult({ path, data });
    };
    const registered = listeners.get(path) || new Set();
    registered.add(receive);
    listeners.set(path, registered);
    artworkCache.get(path).then(receive);
    if (resolve) {
      artworkCache.resolve(path).then(data => {
        for (const callback of listeners.get(path) || []) callback(data);
      }).catch(() => {});
    }
    return () => {
      active = false;
      registered.delete(receive);
      if (!registered.size) listeners.delete(path);
    };
  }, [path, resolve]);
  return result?.path === path ? result.data : null;
}

export function CoverAttribution() {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://thegamesdb.net/').catch(() => {})}>
      <Text style={styles.link}>Front covers from TheGamesDB, when available</Text>
    </Pressable>
  );
}

export default function GameArtwork({ game, style, resolve = false, compact = false }) {
  const cover = useCover(game, resolve);
  const [failed, setFailed] = useState([]);
  const front = game.coverArtUrl || cover?.coverArtUrl;
  const background = game.backgroundImageUrl || game.coverUrl;
  const uri = [front, background].find(url => url && !failed.includes(url));
  return (
    <View style={[styles.case, style]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={(uri === front ? 'Front cover for ' : 'Promotional artwork for ') + game.title}
          onError={() => setFailed(old => [...old, uri])}
        />
      ) : compact ? <Text style={styles.icon}>▥</Text> : (
        <View style={styles.placeholder}>
          <Text style={styles.brand}>SHELFVAULT</Text>
          <Text style={styles.title} numberOfLines={5}>{game.title}</Text>
          <Text style={styles.caption}>Artwork unavailable</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  case: {
    aspectRatio: 0.70, backgroundColor: '#272634', borderRadius: 8, borderWidth: 2,
    borderColor: '#665697', overflow: 'hidden', justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { padding: 8, alignItems: 'center', gap: 8 },
  icon: { color: '#c8baff', textAlign: 'center', fontSize: 19 },
  brand: { color: '#c8baff', fontSize: 9, fontWeight: '800' },
  title: { color: '#fff', fontWeight: '800', textAlign: 'center' },
  caption: { color: '#b7b5c6', fontSize: 10, textAlign: 'center' },
  link: { color: '#c8baff', fontSize: 11, textDecorationLine: 'underline', paddingVertical: 3 },
});
