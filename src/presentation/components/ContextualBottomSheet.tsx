import React, { forwardRef, useMemo } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import BottomSheet, { useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';

export type ContextualBottomSheetProps = {
  children: React.ReactNode;
  onClose: () => void;
  onChange?: (index: number) => void;
  animatedIndex?: SharedValue<number>;
  animatedPosition?: SharedValue<number>;
  mode?: string;
};

const CustomBottomSheetBackground = React.memo(({ style }: any) => (
  <View
    pointerEvents="none"
    style={[
      style,
      styles.sheetContainer,
    ]}
  />
));

export const ContextualBottomSheet = forwardRef<BottomSheet, ContextualBottomSheetProps>(
  ({ children, onClose, onChange, animatedIndex, animatedPosition, mode = 'dynamic' }, ref) => {
    const snapPoints = useMemo(() => {
      switch (mode) {
        case 'chat': return ['90%'];
        case 'alertsAndMessages': return ['90%'];
        case 'province': return ['35%', '90%'];
        case 'citizen': return ['35%', '90%'];
        case 'cause': return ['45%', '90%'];
        case 'actionMenu': return ['32%'];
        case 'provinceForm': return ['65%', '90%'];
        default: return ['40%', '90%'];
      }
    }, [mode]);

    // Resorte amortiguado de alta precisión con overshootClamping: CERO rebote físico
    const animationConfigs = useBottomSheetSpringConfigs({
      damping: 35,
      mass: 1,
      stiffness: 250,
      overshootClamping: true,
    });

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        animationConfigs={animationConfigs}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        enableOverDrag={false}
        // Cerrar el teclado automáticamente en cuanto el usuario toca o arrastra el panel
        enableBlurKeyboardOnGesture={true}
        // El panel SOLO se mueve desde el handle de 48px.
        // El scroll del chat funciona porque el Gesture.Pan() del canvas
        // usa manualActivation y FALLA explícitamente para toques en el
        // área del BottomSheet, liberando el toque para el FlatList nativo.
        enableContentPanningGesture={false}
        enableHandlePanningGesture={true}
        onAnimate={() => {
          Keyboard.dismiss();
        }}
        onChange={(index) => {
          // Solo notificar cambios de snap point que NO sean cierre.
          // El cierre se maneja exclusivamente en onClose, que se dispara
          // DESPUÉS de que la animación termina, evitando cambiar
          // mode/snapPoints durante el gesto de arrastre.
          if (index !== -1) {
            onChange?.(index);
          }
        }}
        onClose={() => {
          Keyboard.dismiss();
          onClose();
        }}
        animatedIndex={animatedIndex}
        animatedPosition={animatedPosition}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        handleStyle={styles.handleContainer}
        handleIndicatorStyle={styles.handleBar}
        backgroundComponent={CustomBottomSheetBackground}
      >
        <View style={styles.contentContainer}>
          {children}
        </View>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    // Extender 1000px hacia abajo para garantizar que NUNCA se despegue ni achique desde abajo
    bottom: -1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 14,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // Área táctil estándar de 48px para arrastre del panel
  },
  handleBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    overflow: 'hidden',
  },
});
