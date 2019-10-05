import { Injectable } from '@nestjs/common';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { Message } from '../interface/model.interface';

@Injectable()
export class MessageService {
    constructor(
        private readonly helper: RedisHelper,
        private readonly redis: Redis
    ){}
    static REDIS_MESSAGE_FIELD = 'msg';

    WrapInfoKey(userId: number) {
        return this.helper.WithRedisNameSpace(`${MessageService.REDIS_MESSAGE_FIELD}:${userId}`);
    }

    async addToMsgList(userId: number, msg: Message): Promise<boolean> {
        return await this.redis.HMSET(this.WrapInfoKey(userId), {
            [ msg.msgId ]: JSON.stringify(msg), 
        });
    }

    async getMsgList(userId: number): Promise<object> {
        return await this.redis.HGETALL(this.WrapInfoKey(userId))
    }
    
    async removeMsgs(userId: number, msgIdArray: string[]): Promise<boolean> {
        return await this.redis.HDEL(this.WrapInfoKey(userId), msgIdArray);
    }

}