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
  mode?: string;
};

export const ContextualBottomSheet = forwardRef<BottomSheet, ContextualBottomSheetProps>(
  ({ children, onClose, animatedIndex, animatedPosition, mode = 'dynamic' }, ref) => {
    const insets = useSafeAreaInsets();

    const snapPoints = useMemo(() => {
      switch (mode) {
        case 'chat': return ['90%'];
        case 'province': return ['25%', '50%', '90%'];
        case 'citizen': return ['30%'];
        case 'cause': return ['45%'];
        case 'actionMenu': return ['30%'];
        case 'provinceForm': return ['60%'];
        default: return ['40%'];
      }
    }, [mode]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false} // Desactivamos dynamic sizing para máxima velocidad
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
        <BottomSheetView style={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {children}
        </BottomSheetView>
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
