import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SharedValue } from 'react-native-reanimated';

export type ContextualBottomSheetProps = {
  children: React.ReactNode;
  onClose: () => void;
  animatedIndex?: SharedValue<number>;
  animatedPosition?: SharedValue<number>;
  mode?: 'chat' | 'province' | 'dynamic';
};

export const ContextualBottomSheet = forwardRef<BottomSheet, ContextualBottomSheetProps>(
  ({ children, onClose, animatedIndex, animatedPosition, mode = 'dynamic' }, ref) => {
    const insets = useSafeAreaInsets();
    
    // Snap points: 
    // If chat mode: we snap exactly to 90%
    // If province mode: snap to 25% and 90%
    // If not: we use dynamic sizing.
    const snapPoints = useMemo(() => {
      if (mode === 'chat') return ['90%'];
      if (mode === 'province') return ['25%', '90%'];
      return undefined;
    }, [mode]);

    return (
      <BottomSheet
        ref={ref}
        index={mode === 'province' ? 0 : -1} // Empezar en 25% para provincia, cerrado para otros
        snapPoints={snapPoints}
        enableDynamicSizing={mode === 'dynamic'} // Autocalcula altura solo si es dynamic
        enablePanDownToClose={true}
        onClose={() => {
          Keyboard.dismiss();
          onClose();
        }}
        animatedIndex={animatedIndex}
        animatedPosition={animatedPosition}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={styles.handleBar}
        backgroundStyle={styles.sheetContainer}
      >
        {mode !== 'dynamic' ? (
          // Si es chat o province, dejamos que el hijo maneje su propio flex
          children
        ) : (
          <BottomSheetView style={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {children}
          </BottomSheetView>
        )}
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  handleBar: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  }
});
