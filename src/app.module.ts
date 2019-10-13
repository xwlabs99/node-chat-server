import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './module/chat/chat.module';
import { AuthorizationMiddleware } from './middleware/authorization.middleware';
import { PushModule } from './module/push/push.module';
@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/chat'),
    ChatModule,
    PushModule
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorizationMiddleware)
      .forRoutes(
        { path: '*', method: RequestMethod.ALL },
      );
  }
}
