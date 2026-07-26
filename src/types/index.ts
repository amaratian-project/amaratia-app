export interface CitizenData {
  npub: string;
  role: string;
  alias?: string;
  localName?: string;
  merit: number;
}

export interface TicketData {
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  creator_id: string;
}

export interface TrustLinkData {
  from_citizen_id: string;
  to_citizen_id: string;
  level: number;
}

export interface MapTopology {
  nodes: any[];
  links: any[];
}
