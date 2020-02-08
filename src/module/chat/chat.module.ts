import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageSchema, UserMsgList } from './model/message.schema';
import { Group, GroupMember } from './model/group.schema';
import { UserSchema, UserFriendList, Friend, UserGroupList, UserGroupItem } from './model/user.schema';
import { UserService } from './service/user.service';
import { UserController } from './controller/user.controller';
import { Redis } from '../../provider/redis.provider';
import { FriendService } from './service/friend.service';
import { FriendController } from './controller/friend.controller';
import { RedisHelper } from './helper/redisHelper.provider';
import { GroupService } from './service/group.service';
import { ChatGateway } from './chat.gateway';
import { MessageService } from './service/message.service';
import { AuthHelper } from './helper/authHelper.provider';
import { ChatService } from './chat.service';
import { GroupController } from './controller/group.controller';
import { MessageController } from './controller/message.controller';
import { PushModule } from '../push/push.module';
import { AuthService } from './service/authority.service';
import { AuthController } from './controller/auth.controller';
import { MysqlModule } from '../../provider/mysql/mysql.module';
import { TaskMysqlProviders } from './model/mysql/index.provider';
import { TaskService } from './service/task.service';
import { TaskController } from './controller/task.controller';
import { TestController } from './test.controller';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'MessageList', schema: UserMsgList },
      { name: 'Message', schema: MessageSchema },
      { name: 'Group', schema: Group },
      { name: 'GroupMember', schema: GroupMember },
      { name: 'Friend', schema: Friend },
      { name: 'FriendList', schema: UserFriendList },
      { name: 'GroupList', schema: UserGroupList },
      { name: 'GroupItem', schema: UserGroupItem },
    ]),
    PushModule,
    MysqlModule,
  ],
  exports: [ UserService ],
  controllers: [
    TestController,
    UserController,
    FriendController,
    GroupController,
    MessageController,
    AuthController,
    TaskController,
  ],
  providers: [
    UserService,
    FriendService,
    GroupService,
    MessageService,
    AuthService,
    Redis,
    RedisHelper,
    AuthHelper,
    ChatGateway,
    ChatService,
    ...TaskMysqlProviders,
    TaskService
  ],
})
export class ChatModule {}
