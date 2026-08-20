import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../entities/user.entity';

@Entity('referral_records')
export class ReferralRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.referralRecords)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referred_id' })
  @Index('UQ_referral_records_referred_id', { unique: true })
  referred: User;

  @Column({ default: false })
  rewardPaid: boolean;

  @Column({ type: 'timestamp', nullable: true })
  rewardPaidAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
