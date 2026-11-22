import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { artworkCache, artworkPath } from './client';
import { coverLookupTitle, fitsPortraitSlot, frontCoverUrl } from './coverPolicy';

const listeners = new Map();
const measurements = new Map();

function useCover(game, resolve) {
  const title = coverLookupTitle(game);
  const path = title && game.platform ? artworkPath(title, game.platform) : null;
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
  return result?.path === path ? frontCoverUrl(result.data, title, game.platform) : undefined;
}

function measure(uri) {
  if (!measurements.has(uri)) {
    measurements.set(uri, Image.getSize(uri).then(fitsPortraitSlot)
      .catch(() => false).finally(() => measurements.delete(uri)));
  }
  return measurements.get(uri);
}

export function CoverAttribution({ compact = false }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://thegamesdb.net/').catch(() => {})}>
      <Text style={styles.link}>{compact ? 'TheGamesDB' : 'Front covers from TheGamesDB, when available'}</Text>
    </Pressable>
  );
}

export default function GameArtwork({ game, style, resolve = false, compact = false }) {
  const candidate = useCover(game, resolve);
  const [verified, setVerified] = useState(null);
  useEffect(() => {
    if (!candidate) return;
    let active = true;
    measure(candidate).then(valid => {
      if (active && valid) setVerified(candidate);
    });
    return () => { active = false; };
  }, [candidate]);
  const uri = candidate && verified === candidate ? verified : undefined;
  return (
    <View style={[styles.case, style]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={'Physical front cover for ' + game.title + ', ' + game.platform}
          onError={() => setVerified(value => value === uri ? null : value)}
        />
      ) : compact ? (
        <Text style={styles.icon} accessibilityLabel={`No verified cover for ${game.title}, ${game.platform || 'platform unselected'}`}>▥</Text>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.brand}>SHELFVAULT</Text>
          <Text style={styles.title} numberOfLines={5}>{game.title}</Text>
          <Text style={styles.platform} numberOfLines={2}>{game.platform || 'Platform unselected'}</Text>
          <Text style={styles.caption}>No verified front cover</Text>
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
  platform: { color: '#d8cdfa', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  caption: { color: '#b7b5c6', fontSize: 10, textAlign: 'center' },
  link: { color: '#c8baff', fontSize: 11, textDecorationLine: 'underline', paddingVertical: 3 },
});
