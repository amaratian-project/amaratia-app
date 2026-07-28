import { useState, useEffect } from 'react';
import { MapNode, MapLink } from '../../types/canvas';
import { vec } from '@shopify/react-native-skia';
import { Dimensions } from 'react-native';
import { GraphTopology } from '../../domain/models/GraphTopology';

const { width, height } = Dimensions.get('window');
const CENTER = vec(width / 2, height / 2);

export const useForceDirectedGraph = (fullTopology: GraphTopology | null) => {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [links, setLinks] = useState<MapLink[]>([]);
  const [bounds, setBounds] = useState({ R: 1000 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!fullTopology) return;

    const nodeMap = new Map<string, MapNode>();

    fullTopology.citizens.forEach(cit => {
      const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
      nodeMap.set(cit.networkData.id, {
        id: cit.networkData.id,
        alias: cit.networkData.alias,
        localName: cit.localData?.localName,
        merit: cit.networkData.merit,
        pos: { x: 0, y: 0 },
        color: colorByLevel[cit.level] || '#94a3b8',
        level: cit.level,
        vx: 0,
        vy: 0
      });
    });

    fullTopology.provinces.forEach(prov => {
      nodeMap.set(prov.id, {
        id: prov.id,
        alias: prov.name,
        localName: undefined,
        merit: 0,
        pos: { x: 0, y: 0 },
        color: '#64748b', // Color para provincia
        level: -1,
        vx: 0,
        vy: 0
      });
    });

    const mainNodes = fullTopology.citizens.filter(n => n.level === 0);
    if (mainNodes.length === 0) {
      setIsLoading(false);
      return;
    }
    
    // Iniciar al maestro en el centro ANTES de crear los links
    const mainId = mainNodes[0].networkData.id;
    nodeMap.get(mainId)!.pos.x = CENTER.x;
    nodeMap.get(mainId)!.pos.y = CENTER.y;

    const allSimNodes = Array.from(nodeMap.values()).slice(0, 300);
    const allowedIds = new Set(allSimNodes.map(n => n.id));
    
    const allSimLinks: MapLink[] = fullTopology.links
      .filter(l => allowedIds.has(l.sourceId) && allowedIds.has(l.targetId))
      .map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color,
        isPrimary: false
      }));

    // 3. Generar Mapa de Hijos y detectar Enlaces Cruzados
    const childrenMap = new Map<string, string[]>();
    allSimNodes.forEach(n => childrenMap.set(n.id, []));
    
    const seenTargets = new Set<string>();
    // Ordenamos para priorizar los enlaces de nivel más bajo (más cercanos al centro) como primarios
    allSimLinks.sort((a, b) => a.level - b.level).forEach(l => {
      if (!seenTargets.has(l.targetId)) {
        l.isPrimary = true;
        seenTargets.add(l.targetId);
        childrenMap.get(l.sourceId)?.push(l.targetId);
      } else {
        l.isPrimary = false;
      }
    });

    // 4. Algoritmo de Estrella Fractal 360° (O(N)) sin físicas
    const nodeWeight = new Map<string, number>();
    const calculateWeight = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        nodeWeight.set(nodeId, 1);
        return 1;
      }
      let weight = 0;
      children.forEach(childId => {
        weight += calculateWeight(childId);
      });
      nodeWeight.set(nodeId, weight);
      return weight;
    };
    calculateWeight(mainId);

    const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

    const distributeStarNodes = (nodeId: string, parentPos: {x:number, y:number}, directionAngle: number, sweepAngle: number, currentLevel: number) => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return;

      const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);
      
      const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle;
      let currentAngleStart = currentLevel === 0 ? 0 : directionAngle - actualSweep / 2;
      
      const useSunflower = children.length > 12 && currentLevel > 0;
      
      children.forEach((childId, index) => {
        const childNode = nodeMap.get(childId);
        if (!childNode) return;

        let finalAngle = 0;
        let finalRadius = 0;
        
        if (useSunflower) {
           const PHI = (1 + Math.sqrt(5)) / 2;
           const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1/PHI); 
           
           finalAngle = directionAngle + (index * GOLDEN_ANGLE);
           
           const c = currentLevel === 1 ? 25 : 15; 
           const startMargin = currentLevel === 1 ? 40 : 25; 
           finalRadius = startMargin + c * Math.sqrt(index + 1);
        } else {
           const weight = nodeWeight.get(childId) || 1;
           const sliceAngle = (weight / totalWeight) * actualSweep;

           const myAngleStart = currentAngleStart;
           const myAngleEnd = currentAngleStart + sliceAngle;
           
           const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
           const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
           finalAngle = baseCenterAngle + angleJitter;
           
           let baseRadius = branchLengths[currentLevel + 1] || 40;
           if (currentLevel === 0) {
             baseRadius = 250 + (index % 5) * 150; 
           } else if (currentLevel === 1) {
             baseRadius = 120 + (index % 3) * 40;
           }
           
           const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0; 
           finalRadius = baseRadius + radiusStagger;
           
           currentAngleStart = myAngleEnd;
        }

        childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
        childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

        const childSweep = currentLevel === 0 ? Math.PI * 1.5 : Math.PI * 0.8;
        distributeStarNodes(childId, childNode.pos, finalAngle, childSweep, currentLevel + 1);
      });
    };

    nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
    distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

    // 4.5 Jiggle de Relajación (Micro-Físicas de Colisión para evitar amontonamientos perfectos)
    const MIN_DIST = 25; 
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < allSimNodes.length; i++) {
        for (let j = i + 1; j < allSimNodes.length; j++) {
          const n1 = allSimNodes[i];
          const n2 = allSimNodes[j];
          if (n1.level === 0 || n2.level === 0) continue; 
          
          const dx = n2.pos.x - n1.pos.x;
          const dy = n2.pos.y - n1.pos.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq > 0 && distSq < MIN_DIST * MIN_DIST) {
            const dist = Math.sqrt(distSq);
            const overlap = MIN_DIST - dist;
            const pushX = (dx / dist) * (overlap * 0.5);
            const pushY = (dy / dist) * (overlap * 0.5);
            
            n1.pos.x -= pushX; n1.pos.y -= pushY;
            n2.pos.x += pushX; n2.pos.y += pushY;
          }
        }
      }
    }

    let maxR = 0;
    allSimNodes.forEach(n => {
      const dx = n.pos.x - CENTER.x;
      const dy = n.pos.y - CENTER.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) maxR = dist;
    });
    setBounds({ R: maxR + 50 });

    setNodes([...allSimNodes]);
    setLinks([...allSimLinks]);
    setIsLoading(false);
  }, [fullTopology]);

  return { nodes, setNodes, links, bounds, isLoading };
};
