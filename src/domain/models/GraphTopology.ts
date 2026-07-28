import { UnifiedCitizenProfile } from './Citizen';
import { Province } from './Province';
import { TrustLink } from './TrustLink';

export interface GraphTopology {
  citizens: UnifiedCitizenProfile[];
  provinces: Province[];
  links: TrustLink[];
}
