export interface PublicNetworkData {
  id: string; // npub
  alias: string;
  merit: number;
  role: string;
}

export interface PrivateLocalData {
  localName?: string;
  notes?: string;
}

export interface UnifiedCitizenProfile {
  networkData: PublicNetworkData;
  localData: PrivateLocalData;
  level: number; // Nivel de grado en el grafo
  nodeType?: 'CITIZEN' | 'PROVINCE';
}
