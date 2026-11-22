import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

const Viewport = createContext(null);

export function ArtworkViewport({ component: List = ScrollView, active = true, ...props }) {
  const frame = useRef(null);
  const viewport = useMemo(() => {
    const observers = new Set();
    let bounds;
    let scheduled = false;
    return {
      active,
      subscribe(callback) {
        observers.add(callback);
        if (bounds) callback(bounds);
        return () => observers.delete(callback);
      },
      refresh() {
        if (!active || scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          frame.current?.measureInWindow((_x, y, width, height) => {
            if (!width || !height) return;
            bounds = { top: y, bottom: y + height };
            for (const observe of observers) observe(bounds);
          });
        });
      },
    };
  }, [active]);

  useEffect(() => { viewport.refresh(); }, [viewport]);
  return (
    <Viewport.Provider value={viewport}>
      <View ref={frame} collapsable={false} onLayout={viewport.refresh} style={{ flex: 1 }}>
        <List {...props} onScroll={viewport.refresh} scrollEventThrottle={100} />
      </View>
    </Viewport.Provider>
  );
}

export function useArtworkVisibility(ref, enabled) {
  const viewport = useContext(Viewport);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || !viewport?.active) {
      setVisible(false);
      return;
    }
    let live = true;
    const unsubscribe = viewport.subscribe(({ top, bottom }) => {
      ref.current?.measureInWindow((_x, y, width, height) => {
        if (live) setVisible(Boolean(width && height && y < bottom && y + height > top));
      });
    });
    viewport.refresh();
    return () => { live = false; unsubscribe(); };
  }, [viewport, enabled, ref]);
  return { visible: visible && viewport?.active, refresh: viewport?.refresh };
}
