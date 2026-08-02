import { UnifiedCitizenProfile } from './Citizen';
import { Province } from './Province';
import { TrustLink } from './TrustLink';
import { Cause } from './Cause';

export interface GraphTopology {
  citizens: UnifiedCitizenProfile[];
  provinces: Province[];
  causes?: Cause[];
  links: TrustLink[];
}
