import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import Citizen from './Citizen';

export default class TrustLink extends Model {
  static table = 'trust_links';

  static associations = {
    citizens: { type: 'belongs_to', key: 'from_citizen_id' },
  } as const;

  @relation('citizens', 'from_citizen_id') fromCitizen: Citizen;
  @relation('citizens', 'to_citizen_id') toCitizen: Citizen;
  @field('level') level: number;
  @date('created_at') createdAt: Date;
}
