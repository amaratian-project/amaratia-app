import { UnifiedCitizenProfile } from './Citizen';
import { Province } from './Province';
import { TrustLink } from './TrustLink';

export interface Cause {
  id: string;
  title: string;
  description: string;
  supportersCount: number;
  status: string;
  level: number;
}

export interface GraphTopology {
  citizens: UnifiedCitizenProfile[];
  provinces: Province[];
  causes?: Cause[];
  links: TrustLink[];
}
