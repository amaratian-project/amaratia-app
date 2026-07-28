const fs = require('fs');
const path = 'c:/Users/Aurelio/Documents/GitHub/Amaratia/src/presentation/components/CanvasMap.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{selectedNode && \([\s\S]*?<NodeInfoOverlay[\s\S]*?\/>\s*\)\}/;

const newHUD = `{/* HUD INFERIOR UNIFICADO (Flexbox) */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>
        {/* Fondo oscuro interactivo */}
        {(showActionMenu || selectedNode) && (
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={closePanels} />
        )}
        
        {/* Navegador de Niveles (LOD) apoyado sobre el panel */}
        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️' },
              { level: 2, label: 'Provincias', icon: '🏛️' },
              { level: 1, label: 'Ciudadanos', icon: '👤' },
            ].map((item) => {
              const isActive = currentLOD === item.level;
              return (
                <Pressable key={item.level} onPress={() => goToLOD(item.level)} style={[styles.lodSegment, isActive && styles.lodSegmentActive]}>
                  <Text style={[styles.lodSegmentIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={{ width: '100%', pointerEvents: 'box-none' }}>
          
          {(selectedNode || showActionMenu) && (
            <ContextualBottomSheet panelTranslateY={panelTranslateY} onClose={closePanels}>
              {selectedNode && (
                <CitizenProfileContent 
                  citizen={selectedNode as any}
                  onClose={closePanels}
                  onViewProfile={() => {}}
                  onUpdateLocalName={(newName: string | undefined) => {
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                    setSelectedNode({ ...selectedNode, localName: newName } as any);
                  }}
                />
              )}
              {showActionMenu && (
                <ActionMenuContent 
                  onScanCitizen={() => {
                    closePanels();
                  }}
                  onCreateProvince={() => {
                    closePanels();
                    console.log('Navegar a Crear Provincia');
                  }}
                />
              )}
            </ContextualBottomSheet>
          )}

          {!selectedNode && !showActionMenu && (
            <View style={{ alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
              <FloatingDock
                onAddPress={openActionMenu}
                onMessagePress={() => console.log('Mensajes')}
                onMarketPress={() => console.log('Mercado')}
                onVotePress={() => console.log('Votaciones')}
                onProfilePress={() => setShowQR(true)} 
              />
            </View>
          )}

        </View>
      </View>
      {showQR && (
        <QRGenerator 
          identity={{ did: 'did:amar:dummy', keys: {} } as any} 
          onClose={() => setShowQR(false)} 
        />
      )}`;

if (regex.test(content)) {
  content = content.replace(regex, newHUD);
  
  // also add styles if missing
  if (content.indexOf('lodControlsContainer:') === -1) {
    const newStyles = `lodControlsContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },
  lodSegment: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentActive: {
    backgroundColor: '#3b82f6', 
  },
  lodSegmentIcon: {
    fontSize: 24, 
    opacity: 0.6,
  }`;
    content = content.replace("canvasWrapper: {\n    flex: 1,\n  }", "canvasWrapper: {\n    flex: 1,\n  },\n  " + newStyles);
    // fallback for CRLF
    content = content.replace("canvasWrapper: {\r\n    flex: 1,\r\n  }", "canvasWrapper: {\r\n    flex: 1,\r\n  },\r\n  " + newStyles);
  }
  
  fs.writeFileSync(path, content, 'utf8');
  console.log("Replaced perfectly.");
} else {
  console.log("Regex didn't match.");
}
