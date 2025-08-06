import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('server_keys')
export class ServerKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  publicKeyPem: string;

  @Column('text')
  privateKeyPem: string;

  @Column()
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
