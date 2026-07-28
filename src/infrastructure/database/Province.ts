import { Model, Query } from '@nozbe/watermelondb';
import { field, text, date, children } from '@nozbe/watermelondb/decorators';

export default class Province extends Model {
  static table = 'provinces';

  static associations = {
    citizen_provinces: { type: 'has_many', foreignKey: 'province_id' },
    causes: { type: 'has_many', foreignKey: 'province_id' },
  } as const;

  @text('pubkey') pubkey!: string;
  @text('name') name!: string;
  @text('description') description?: string;
  @text('founder_pubkey') founderPubkey!: string;
  @text('status') status!: string; // 'DRAFT' | 'ACTIVE'
  @field('is_public') isPublic!: boolean;
  @date('created_at') createdAt!: number;

  @children('citizen_provinces') citizenProvinces: Query<any>;
  @children('causes') causes: Query<any>;
}
