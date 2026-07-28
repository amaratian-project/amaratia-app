import { Model } from '@nozbe/watermelondb';
import { field, text, date, relation } from '@nozbe/watermelondb/decorators';

export default class Cause extends Model {
  static table = 'causes';

  static associations = {
    provinces: { type: 'belongs_to', key: 'province_id' },
  } as const;

  @text('pubkey') pubkey: string;
  @text('title') title: string;
  @text('status') status: string;
  @date('created_at') createdAt: Date;

  @relation('provinces', 'province_id') province: any;
}
