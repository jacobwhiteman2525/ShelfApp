import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { artworkCache, artworkPath } from './client';
import { coverLookupTitle, fitsPortraitSlot, frontCoverUrl } from './coverPolicy';
import { useArtworkVisibility } from './ArtworkViewport';

const listeners = new Map();
const measurements = new Map();

function useCover(game, resolve) {
  const title = coverLookupTitle(game);
  const platform = typeof game.platform === 'string' ? game.platform.trim() : '';
  const path = title && platform ? artworkPath(title.trim(), platform) : null;
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const receive = data => {
      if (active && data) setResult({ path, data });
    };
    const registered = listeners.get(path) || new Set();
    registered.add(receive);
    listeners.set(path, registered);
    artworkCache.cached(path, title.trim(), platform).then(entry => receive(entry?.data));
    let retry;
    if (resolve) {
      const lookup = (retrying = false) => {
        artworkCache.resolve(path, title.trim(), platform).then(data => {
          if (active) report(game.title, platform, data);
          for (const callback of listeners.get(path) || []) callback(data);
          if (active && !retrying && ['lookup_busy', 'provider_failed'].includes(data.status)) {
            retry = setTimeout(() => lookup(true), data.retryAfterMs || 4000);
          }
        });
      };
      lookup();
    }
    return () => {
      active = false;
      clearTimeout(retry);
      registered.delete(receive);
      if (!registered.size) listeners.delete(path);
    };
  }, [path, resolve, title, platform, game.title]);
  return result?.path === path ? frontCoverUrl(result.data, title.trim(), platform) : undefined;
}

function report(title, platform, result) {
  if (__DEV__) console.debug('[ShelfVault artwork]', {
    title, platform, status: result.cachedNegative ? 'cached_negative' : result.status,
    reason: result.cachedNegative ? result.status : undefined, providerStatus: result.providerStatus,
  });
}

function measure(uri) {
  if (!measurements.has(uri)) {
    measurements.set(uri, Image.getSize(uri).then(size =>
      fitsPortraitSlot(size) ? 'ready' : 'image_dimensions_rejected')
      .catch(() => 'image_download_failed').finally(() => measurements.delete(uri)));
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
  const frame = useRef(null);
  const { visible, refresh } = useArtworkVisibility(frame, compact && Boolean(game.platform));
  const candidate = useCover(game, resolve || visible);
  const [verified, setVerified] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useRef();
  const retryImage = () => {
    clearTimeout(retry.current);
    if (attempt < 2) retry.current = setTimeout(() => setAttempt(value => value + 1), 1500 * (attempt + 1));
  };
  useEffect(() => {
    setAttempt(0);
    return () => clearTimeout(retry.current);
  }, [candidate, visible]);
  useEffect(() => {
    if (!candidate) return;
    let active = true;
    measure(candidate).then(status => {
      if (!active) return;
      if (status === 'ready') setVerified({ uri: candidate, attempt });
      else {
        report(game.title, game.platform, { status });
        if (status === 'image_download_failed') retryImage();
      }
    });
    return () => { active = false; };
  }, [candidate, attempt, game.title, game.platform, visible]);
  const uri = candidate && verified?.uri === candidate && verified.attempt === attempt ? candidate : undefined;
  return (
    <View ref={frame} collapsable={false} onLayout={refresh} style={[styles.case, style]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={'Physical front cover for ' + game.title + ', ' + game.platform}
          onLoad={() => report(game.title, game.platform, { status: 'image_rendered' })}
          onError={() => {
            setVerified(null);
            report(game.title, game.platform, { status: 'image_download_failed' });
            retryImage();
          }}
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
