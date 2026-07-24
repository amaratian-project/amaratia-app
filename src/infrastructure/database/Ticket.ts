import { Model } from '@nozbe/watermelondb';
import { field, text, date, relation } from '@nozbe/watermelondb/decorators';
import Citizen from './Citizen';

export default class Ticket extends Model {
  static table = 'tickets';

  static associations = {
    citizens: { type: 'belongs_to', key: 'creator_id' },
  } as const;

  @text('title') title: string;
  @text('status') status: string; // TODO, IN_PROGRESS, DONE
  @relation('citizens', 'creator_id') creator: Citizen;
  @date('created_at') createdAt: Date;
}
