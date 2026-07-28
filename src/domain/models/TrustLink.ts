export interface TrustLink {
  sourceId: string;
  targetId: string;
  level: number;
  type: 'TRUST' | 'MEMBERSHIP' | 'AUTHOR';
}
