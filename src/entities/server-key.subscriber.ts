import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, LoadEvent, DataSource } from 'typeorm';
import { ServerKey } from './server-key.entity';
import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../encryption/encryption.service';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
@EventSubscriber()
export class ServerKeySubscriber implements EntitySubscriberInterface<ServerKey> {
  constructor( @InjectDataSource() readonly connection: DataSource, private encryptionService: EncryptionService) {
     connection.subscribers.push(this);
  }

  listenTo() {
    return ServerKey;
  }
  
  async beforeInsert(event: InsertEvent<ServerKey>) {
    if (event.entity.privateKeyPem) {
      event.entity.privateKeyPem = await this.encryptionService.encrypt(event.entity.privateKeyPem);
    }
  }

  async beforeUpdate(event: UpdateEvent<ServerKey>) {
    if (event.entity?.privateKeyPem) {
      event.entity.privateKeyPem = await this.encryptionService.encrypt(event.entity.privateKeyPem);
    }
  }

  async afterLoad(entity: ServerKey, event?: LoadEvent<ServerKey>) {
    if (entity.privateKeyPem) {
      entity.privateKeyPem = await this.encryptionService.decrypt(entity.privateKeyPem);
    }
  }
}