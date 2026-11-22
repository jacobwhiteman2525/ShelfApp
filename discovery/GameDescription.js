import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function GameDescription({ description, style }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  return (
    <View>
      <Text style={style} numberOfLines={expanded ? undefined : 4}>{description}</Text>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={styles.measure}>
        <Text style={style} onTextLayout={event => setOverflow(event.nativeEvent.lines.length > 4)}>
          {description}
        </Text>
      </View>
      {overflow && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)} style={styles.control}>
          <Text style={styles.label}>{expanded ? 'Show less ⌃' : 'Read full description ⌄'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  control: { alignSelf: 'flex-start', paddingVertical: 8 },
  label: { color: '#c8baff', fontWeight: '700' },
});
