import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_public_keys')
export class UserPublicKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column('text')
  publicKeyPem: string;

  @Column()
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.publicKeys)
  @JoinColumn({ name: 'userId' })
  user: User;
}
