export type CivicTitleCategory = 'ARCHITECT' | 'CONSUL' | 'CITIZEN' | 'TOURIST' | 'CUSTOM';

// Clave pública fundacional del Arquitecto de Amaratia (permanente y soberana)
export let GENESIS_ARCHITECT_NPUB = '';

export const setGenesisArchitectNpub = (npub: string) => {
  GENESIS_ARCHITECT_NPUB = npub;
};

export interface CivicTitle {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: CivicTitleCategory;
  details?: string[]; // Por ejemplo, lista de nombres de provincias para Cónsul
}

export interface TitleEvaluationContext {
  npub: string;
  isGenesis: boolean;
  activeVisasCount: number;
  provinces: string[];
  merit?: number;
}

export interface ITitleRule {
  readonly titleId: string;
  evaluate(context: TitleEvaluationContext): CivicTitle | null;
}

export interface CivicProfile {
  alias: string;
  npub: string;
  role: 'CITIZEN' | 'TOURIST';
  isGenesis: boolean;
  titles: CivicTitle[];
  networkStats: {
    level1: number;
    level2: number;
    level3: number;
  };
  provinces: string[];
}
