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
        color: '#f59e0b', // Color ámbar para provincia
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
          color: '#ec4899', // Color magenta para Causas
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

    // Iniciar al maestro en el centro ANTES de crear los links
    const mainId = mainNodes[0].networkData.id;
    nodeMap.get(mainId)!.pos.x = CENTER.x;
    nodeMap.get(mainId)!.pos.y = CENTER.y;

    const citizenNodes = Array.from(nodeMap.values()).filter(n => n.level >= 0);
    const provinceNodes = Array.from(nodeMap.values()).filter(n => n.level === -1);
    const causeNodes = Array.from(nodeMap.values()).filter(n => n.level === -2);
    const citizenIds = new Set(citizenNodes.map(n => n.id));

    // Solo mapear todos los enlaces, pero los primarios (para el fractal) serán solo de ciudadanos
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

    // 3. Generar Mapa de Hijos y detectar Enlaces Cruzados (Solo para Ciudadanos)
    const childrenMap = new Map<string, string[]>();
    citizenNodes.forEach(n => childrenMap.set(n.id, []));

    const seenTargets = new Set<string>();
    allSimLinks
      .filter(l => l.type !== 'MEMBERSHIP' && citizenIds.has(l.sourceId) && citizenIds.has(l.targetId))
      .sort((a, b) => a.level - b.level)
      .forEach(l => {
        if (!seenTargets.has(l.targetId)) {
          l.isPrimary = true;
          seenTargets.add(l.targetId);
          childrenMap.get(l.sourceId)?.push(l.targetId);
        } else {
          l.isPrimary = false;
        }
      });

    // 4. Algoritmo de Estrella Fractal 360° (O(N)) sin físicas
    // Para calcular cuánto ángulo (tajada) recibe cada rama, usamos la RAÍZ CUADRADA de sus descendientes.
    // Como las ramas se expanden en 2D (área), su ancho angular debe crecer con la raíz del área, no linealmente.
    const rawCount = new Map<string, number>();
    const nodeWeight = new Map<string, number>();

    const calculateDescendants = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        rawCount.set(nodeId, 1);
        nodeWeight.set(nodeId, 1);
        return 1;
      }
      let sum = 1; // Contarse a sí mismo
      children.forEach(childId => {
        sum += calculateDescendants(childId);
      });
      rawCount.set(nodeId, sum);

      // El peso angular es la raíz cuadrada de la cantidad total de nodos en esta rama
      // Esto evita que las ramas masivas aplasten a los nodos pequeños, distribuyendo mejor el espacio vacío.
      nodeWeight.set(nodeId, Math.sqrt(sum));

      return sum;
    };
    calculateDescendants(mainId);

    const branchLengths: Record<number, number> = { 1: 300, 2: 100, 3: 40, 4: 30, 5: 30 };

    const distributeStarNodes = (nodeId: string, parentPos: { x: number, y: number }, directionAngle: number, sweepAngle: number, currentLevel: number) => {
      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) return;

      const totalWeight = children.reduce((sum, childId) => sum + (nodeWeight.get(childId) || 1), 0);

      const actualSweep = currentLevel === 0 ? Math.PI * 2 : sweepAngle;
      let currentAngleStart = currentLevel === 0 ? 0 : directionAngle - actualSweep / 2;

      const useSunflower = false;

      children.forEach((childId, index) => {
        const childNode = nodeMap.get(childId);
        if (!childNode) return;

        let finalAngle = 0;
        let finalRadius = 0;

        if (useSunflower) {
          const PHI = (1 + Math.sqrt(5)) / 2;
          const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / PHI);

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

    // 4.5 Jiggle de Relajación (Membrana Magnética con Conciencia de Familia)
    // Asignamos un "ID de Familia" a cada nodo (su ancestro de Nivel 1 - Nodo Azul)
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

    // Aplicamos un Jiggle que es permisivo internamente, pero muy repulsivo con extraños
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

          // Si son de la misma familia, permitimos que se empaqueten densamente (margen 5px)
          // Si son de familias distintas, actúan como imanes repelentes (margen 35px) creando una frontera.
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

    // 5. Distribuir Provincias (LOD 2) usando espiral botánica (Fermat/Sunflower)
    const PHI = (1 + Math.sqrt(5)) / 2;
    const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / PHI);

    const LOD2Margin = 200;
    const baseProvinceRadius = maxR + LOD2Margin;
    // El radio de una provincia es 180 (diámetro 360). Para evitar que se toquen,
    // usamos c = Diámetro / sqrt(PI) + Margen => c aprox 240
    const cProvince = 120; //margen entre provincias
    let maxProvinceR = baseProvinceRadius;

    provinceNodes.forEach((prov, i) => {
      const angle = i * GOLDEN_ANGLE;
      const r = baseProvinceRadius + cProvince * Math.sqrt(i + 1);
      if (r > maxProvinceR) maxProvinceR = r;

      prov.pos.x = CENTER.x + Math.cos(angle) * r;
      prov.pos.y = CENTER.y + Math.sin(angle) * r;
    });

    // 6. Distribuir Causas (LOD 3) usando espiral botánica
    const LOD3Margin = 700;
    const baseCauseRadius = maxProvinceR + LOD3Margin;
    // El radio de una causa es 220 (diámetro 440). c = 440 / 1.77 + Margen => c aprox 320
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

    // Detectar o crear enlaces punteados blancos entre provincias que comparten ciudadanos
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

        // Crear la línea de interconexión SOLO si comparten verdaderamente al menos un ciudadano
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
