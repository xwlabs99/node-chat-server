import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushUserSchema } from './push.schema';
import { PushGateway } from './push.gateway';
import { PushController } from './push.controller';
import { Redis } from '../../provider/redis.provider';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PushUser', schema: PushUserSchema },
    ]),
  ],
  exports: [ PushGateway ],
  controllers: [ PushController ],
  providers: [
    PushGateway,
    Redis,
  ],
})
export class PushModule {}
