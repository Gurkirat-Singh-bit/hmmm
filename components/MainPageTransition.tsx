/**
 * @file MainPageTransition.tsx
 * @description Subtle entrance animation shared by primary application pages.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export function MainPageTransition({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      duration: 240,
      easing: (value) => 1 - Math.pow(1 - value, 3),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.page,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },
});
