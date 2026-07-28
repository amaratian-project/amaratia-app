import { Model } from '@nozbe/watermelondb';
import { field, text, date, relation } from '@nozbe/watermelondb/decorators';

export default class CitizenProvince extends Model {
  static table = 'citizen_provinces';

  static associations = {
    citizens: { type: 'belongs_to', key: 'citizen_id' },
    provinces: { type: 'belongs_to', key: 'province_id' },
  } as const;

  @text('title') title?: string;
  @date('joined_at') joinedAt!: number;

  @relation('citizens', 'citizen_id') citizen: any;
  @relation('provinces', 'province_id') province: any;
}
