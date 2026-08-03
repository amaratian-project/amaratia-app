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
  const [bounds, setBounds] = useState({ R: 1000, citizenR: 500, provinceR: 1000, causeR: 1500 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!fullTopology) return;

    // ═══════════════════════════════════════════════════════════════
    // 1. CREAR NODOS DE MAPA (MapNode) A PARTIR DE LA TOPOLOGÍA
    // ═══════════════════════════════════════════════════════════════
    const nodeMap = new Map<string, MapNode>();

    fullTopology.citizens.forEach(cit => {
      const colorByLevel = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
      nodeMap.set(cit.networkData.id, {
        id: cit.networkData.id,
        alias: cit.networkData.alias,
        npub: cit.networkData.npub,
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
        color: '#f59e0b',
        level: -1,
        vx: 0,
        vy: 0
      });
    });

    if (fullTopology.causes) {
      fullTopology.causes.forEach(cause => {
        nodeMap.set(cause.id, {
          id: cause.id,
          alias: cause.title,
          localName: cause.description,
          merit: cause.supportersCount,
          pos: { x: 0, y: 0 },
          color: '#ec4899',
          level: -2,
          vx: 0,
          vy: 0
        });
      });
    }

    const mainNodes = fullTopology.citizens.filter(n => n.level === 0);
    if (mainNodes.length === 0) {
      setIsLoading(false);
      return;
    }

    const mainId = mainNodes[0].networkData.id;
    nodeMap.get(mainId)!.pos.x = CENTER.x;
    nodeMap.get(mainId)!.pos.y = CENTER.y;

    const citizenNodes = Array.from(nodeMap.values()).filter(n => n.level >= 0);
    const provinceNodes = Array.from(nodeMap.values()).filter(n => n.level === -1);
    const causeNodes = Array.from(nodeMap.values()).filter(n => n.level === -2);
    const citizenIds = new Set(citizenNodes.map(n => n.id));

    // ═══════════════════════════════════════════════════════════════
    // 2. CREAR LINKS DE MAPA (MapLink) Y ADJACENCY LIST
    // ═══════════════════════════════════════════════════════════════
    const allSimLinks: MapLink[] = fullTopology.links
      .filter(l => nodeMap.has(l.sourceId) && nodeMap.has(l.targetId))
      .map(l => ({
        sourceId: l.sourceId,
        targetId: l.targetId,
        p1: nodeMap.get(l.sourceId)!.pos,
        p2: nodeMap.get(l.targetId)!.pos,
        level: l.level,
        color: nodeMap.get(l.targetId)!.color,
        isPrimary: false,
        type: (l as any).type || 'TRUST'
      }));

    // Construir adjacency list SOLO para citizen links (no membresía, no causas)
    // Cada entrada: nodeId → [{neighborId, linkIndex}]
    const citizenAdjacency = new Map<string, { neighborId: string; linkIdx: number }[]>();
    citizenNodes.forEach(n => citizenAdjacency.set(n.id, []));

    allSimLinks.forEach((link, idx) => {
      if (link.type !== 'TRUST') return;
      if (!citizenIds.has(link.sourceId) || !citizenIds.has(link.targetId)) return;

      if (citizenAdjacency.has(link.sourceId)) {
        citizenAdjacency.get(link.sourceId)!.push({ neighborId: link.targetId, linkIdx: idx });
      }
      if (citizenAdjacency.has(link.targetId)) {
        citizenAdjacency.get(link.targetId)!.push({ neighborId: link.sourceId, linkIdx: idx });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. BFS SPANNING TREE (libre de ciclos, O(N+E))
    //    Cada nodo se descubre exactamente una vez.
    //    Su primer descubridor es su padre en el spanning tree.
    //    Los demás enlaces se dejan como isPrimary = false (cross-links).
    // ═══════════════════════════════════════════════════════════════
    const childrenMap = new Map<string, string[]>();
    citizenNodes.forEach(n => childrenMap.set(n.id, []));

    const visited = new Set<string>([mainId]);
    const bfsQueue: string[] = [mainId];

    while (bfsQueue.length > 0) {
      const parentId = bfsQueue.shift()!;
      const neighbors = citizenAdjacency.get(parentId) || [];

      for (const { neighborId, linkIdx } of neighbors) {
        if (!visited.has(neighborId)) {
          // Primera vez que descubrimos este nodo → es hijo de parentId
          visited.add(neighborId);
          childrenMap.get(parentId)!.push(neighborId);
          allSimLinks[linkIdx].isPrimary = true;
          bfsQueue.push(neighborId);
        }
        // Si ya fue visitado, el link queda como isPrimary = false (cross-link) → correcto
      }
    }

    // Nodos huérfanos (desconectados del grafo principal) → atar al mainId
    citizenNodes.forEach(n => {
      if (!visited.has(n.id)) {
        visited.add(n.id);
        childrenMap.get(mainId)!.push(n.id);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. ALGORITMO DE ESTRELLA FRACTAL 360° (O(N))
    //    Usa calculateDescendants iterativo para evitar stack overflow.
    // ═══════════════════════════════════════════════════════════════
    const nodeWeight = new Map<string, number>();

    // Cálculo iterativo de descendientes (post-order DFS con stack explícito)
    {
      const stack: { id: string; phase: 'enter' | 'exit' }[] = [{ id: mainId, phase: 'enter' }];
      const childIndex = new Map<string, number>();

      while (stack.length > 0) {
        const top = stack[stack.length - 1];

        if (top.phase === 'enter') {
          const children = childrenMap.get(top.id) || [];
          if (children.length === 0) {
            nodeWeight.set(top.id, 1);
            stack.pop();
          } else {
            top.phase = 'exit';
            childIndex.set(top.id, 0);
            // Push children in reverse order so they process left-to-right
            for (let i = children.length - 1; i >= 0; i--) {
              stack.push({ id: children[i], phase: 'enter' });
            }
          }
        } else {
          // exit phase: all children have been computed
          const children = childrenMap.get(top.id) || [];
          let sum = 1; // count self
          for (const childId of children) {
            sum += (nodeWeight.get(childId) || 1);
          }
          nodeWeight.set(top.id, Math.sqrt(sum));
          stack.pop();
        }
      }
    }

    const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

    const distributeStarNodes = (nodeId: string, parentPos: { x: number, y: number }, directionAngle: number, sweepAngle: number, currentLevel: number) => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return;

      const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);

      const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle;
      let currentAngleStart = currentLevel === 0 ? 0 : directionAngle - actualSweep / 2;

      children.forEach((childId, index) => {
        const childNode = nodeMap.get(childId);
        if (!childNode) return;

        const weight = nodeWeight.get(childId) || 1;
        const sliceAngle = (weight / totalWeight) * actualSweep;

        const myAngleStart = currentAngleStart;
        const myAngleEnd = currentAngleStart + sliceAngle;

        const baseCenterAngle = (myAngleStart + myAngleEnd) / 2;
        const angleJitter = currentLevel > 0 ? Math.sin(index * 73) * (sliceAngle * 0.1) : 0;
        const finalAngle = baseCenterAngle + angleJitter;

        let baseRadius = branchLengths[currentLevel + 1] || 40;
        if (currentLevel === 0) {
          baseRadius = 250 + (index % 5) * 150;
        } else if (currentLevel === 1) {
          baseRadius = 120 + (index % 3) * 40;
        }

        const radiusStagger = currentLevel > 0 ? (index % 3 - 1) * 15 : 0;
        const finalRadius = baseRadius + radiusStagger;

        currentAngleStart = myAngleEnd;

        childNode.pos.x = parentPos.x + Math.cos(finalAngle) * finalRadius;
        childNode.pos.y = parentPos.y + Math.sin(finalAngle) * finalRadius;

        const childSweep = currentLevel === 0 ? Math.PI * 1.5 : Math.PI * 0.8;
        distributeStarNodes(childId, childNode.pos, finalAngle, childSweep, currentLevel + 1);
      });
    };

    nodeMap.get(mainId)!.pos = { x: CENTER.x, y: CENTER.y };
    distributeStarNodes(mainId, { x: CENTER.x, y: CENTER.y }, 0, Math.PI * 2, 0);

    // ═══════════════════════════════════════════════════════════════
    // 4.5. JIGGLE DE RELAJACIÓN (Membrana Magnética)
    // ═══════════════════════════════════════════════════════════════
    const familyMap = new Map<string, string>();
    const level1Nodes = childrenMap.get(mainId) || [];

    level1Nodes.forEach(blueId => {
      familyMap.set(blueId, blueId);
      const assignFamily = (currentId: string) => {
        const children = childrenMap.get(currentId) || [];
        children.forEach(childId => {
          familyMap.set(childId, blueId);
          assignFamily(childId);
        });
      };
      assignFamily(blueId);
    });

    const getCitizenRadius = (level: number) => {
      switch (level) {
        case 0: return 28;
        case 1: return 16;
        case 2: return 11;
        case 3: default: return 7;
      }
    };

    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < citizenNodes.length; i++) {
        for (let j = i + 1; j < citizenNodes.length; j++) {
          const n1 = citizenNodes[i];
          const n2 = citizenNodes[j];
          if (n1.level === 0 || n2.level === 0) continue;

          const f1 = familyMap.get(n1.id);
          const f2 = familyMap.get(n2.id);
          const isSameFamily = f1 === f2;

          const dx = n2.pos.x - n1.pos.x;
          const dy = n2.pos.y - n1.pos.y;
          const distSq = dx * dx + dy * dy;

          const padding = isSameFamily ? 25 : 50;
          const minDist = getCitizenRadius(n1.level) + getCitizenRadius(n2.level) + padding;

          if (distSq > 0 && distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;

            const pushX = (dx / dist) * (overlap * 0.25);
            const pushY = (dy / dist) * (overlap * 0.25);

            n1.pos.x -= pushX;
            n1.pos.y -= pushY;
            n2.pos.x += pushX;
            n2.pos.y += pushY;
          }
        }
      }
    }

    let maxR = 0;
    citizenNodes.forEach(n => {
      const dx = n.pos.x - CENTER.x;
      const dy = n.pos.y - CENTER.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) maxR = dist;
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. DISTRIBUIR PROVINCIAS (LOD 2) - Espiral Fermat/Sunflower
    // ═══════════════════════════════════════════════════════════════
    const PHI = (1 + Math.sqrt(5)) / 2;
    const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / PHI);

    const LOD2Margin = 200;
    const baseProvinceRadius = maxR + LOD2Margin;
    const cProvince = 120;
    let maxProvinceR = baseProvinceRadius;

    provinceNodes.forEach((prov, i) => {
      const angle = i * GOLDEN_ANGLE;
      const r = baseProvinceRadius + cProvince * Math.sqrt(i + 1);
      if (r > maxProvinceR) maxProvinceR = r;

      prov.pos.x = CENTER.x + Math.cos(angle) * r;
      prov.pos.y = CENTER.y + Math.sin(angle) * r;
    });

    // ═══════════════════════════════════════════════════════════════
    // 6. DISTRIBUIR CAUSAS (LOD 3) - Espiral Fermat/Sunflower
    // ═══════════════════════════════════════════════════════════════
    const LOD3Margin = 700;
    const baseCauseRadius = maxProvinceR + LOD3Margin;
    const cCause = 320;
    let maxCauseR = baseCauseRadius;

    causeNodes.forEach((cause, i) => {
      const angle = (i * GOLDEN_ANGLE) + Math.PI;
      const r = baseCauseRadius + cCause * Math.sqrt(i + 1);
      if (r > maxCauseR) maxCauseR = r;

      cause.pos.x = CENTER.x + Math.cos(angle) * r;
      cause.pos.y = CENTER.y + Math.sin(angle) * r;
    });

    setBounds({ R: maxCauseR + 500, citizenR: maxR + 100, provinceR: maxProvinceR + 250, causeR: maxCauseR + 300 });

    // Detectar enlaces blancos entre provincias que comparten ciudadanos
    const provinceCitizenMap = new Map<string, Set<string>>();
    allSimLinks
      .filter(l => l.type === 'MEMBERSHIP')
      .forEach(l => {
        const provId = provinceNodes.some(p => p.id === l.sourceId) ? l.sourceId : l.targetId;
        const citId = provId === l.sourceId ? l.targetId : l.sourceId;
        if (!provinceCitizenMap.has(provId)) provinceCitizenMap.set(provId, new Set());
        provinceCitizenMap.get(provId)?.add(citId);
      });

    const interProvinceLinks: MapLink[] = [];
    for (let i = 0; i < provinceNodes.length; i++) {
      for (let j = i + 1; j < provinceNodes.length; j++) {
        const p1 = provinceNodes[i];
        const p2 = provinceNodes[j];
        const c1 = provinceCitizenMap.get(p1.id) || new Set();
        const c2 = provinceCitizenMap.get(p2.id) || new Set();

        let sharesCitizen = false;
        for (const citId of c1) {
          if (c2.has(citId)) {
            sharesCitizen = true;
            break;
          }
        }

        if (sharesCitizen) {
          interProvinceLinks.push({
            sourceId: p1.id,
            targetId: p2.id,
            p1: p1.pos,
            p2: p2.pos,
            level: -1,
            color: '#ffffff',
            isPrimary: false,
            type: 'PROVINCE_INTERCONNECT' as any
          });
        }
      }
    }

    const finalSimNodes = [...citizenNodes, ...provinceNodes, ...causeNodes];
    setNodes(finalSimNodes);
    setLinks([...allSimLinks, ...interProvinceLinks]);
    setIsLoading(false);
  }, [fullTopology]);

  return { nodes, setNodes, links, bounds, isLoading };
};
