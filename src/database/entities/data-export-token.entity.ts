import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('data_export_tokens')
export class DataExportToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid' })
  exportId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'varchar' })
  filePath: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
