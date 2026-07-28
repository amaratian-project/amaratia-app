export interface MapNode {
  id: string;
  alias: string;
  localName?: string;
  merit: number;
  pos: { x: number; y: number };
  color: string;
  level: number;
  vx: number;
  vy: number;
}

export interface MapLink {
  sourceId: string;
  targetId: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  level: number;
  color: string;
  isPrimary?: boolean;
}
