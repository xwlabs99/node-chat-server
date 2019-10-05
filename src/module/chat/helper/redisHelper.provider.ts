import { Injectable } from '@nestjs/common';
@Injectable()
export class RedisHelper {
    private CHAT_NAMESPACE = 'CHAT';

    WithRedisNameSpace(key) {
        return this.CHAT_NAMESPACE + ':' + key;
    }

}