import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
  } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { Injectable, Inject, forwardRef, HttpService } from '@nestjs/common';
import { UserService } from './service/user.service';
import { MessageService } from './service/message.service';
import { GroupService } from './service/group.service';
import { FriendService } from './service/friend.service';
import { Redis } from '../../provider/redis.provider';
import { AuthHelper } from './helper/authHelper.provider';
import { RedisHelper } from './helper/redisHelper.provider';

interface onConnect {
    userId: number,
    name: string,
    pushToken: string,
    pushType: string,
    authToken?: string,
    platform: string,
    buildId: string,
    systemVersion: string,
    deviceBrand: string,
    loginTimestamp: string,
    socketId: string,
}



@Injectable()
@WebSocketGateway()
export class ChatGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly userService: UserService,
        private readonly messageService: MessageService,
        private readonly groupService: GroupService,
        private readonly friendService: FriendService,
        private readonly authHelper: AuthHelper,
        private readonly redisHelper: RedisHelper,
        private readonly redis: Redis,
    ){}

    private _getClient(socketId: string): Socket {
        return this.server.sockets.sockets[socketId];
    }

   

    async sendMessageToClient(uid, msg) {
       
    }


    //-----------单点登录-------------
    // 客户端连接
    @SubscribeMessage('connected')
    async onConnect(client: Client, data: onConnect) {
        const { id: socketId } = client;
        const { authToken, userId } = data;
        const auth: any = await this.authHelper.JWTverify(authToken);
        if(auth && auth.id === userId) {
            const connectInfo: any = await this._getUserLoginInfo(userId);
            // 第一次登录
            if(!connectInfo) {
                console.log('第一次登录');
                const loginTimestamp = String(new Date().getTime());
                this._setUserLoginInfo({...data, socketId, loginTimestamp });
                return {
                    status: 1,
                    loginTimestamp
                }
            } else {
                if(!data.loginTimestamp) {
                     // 异地登录界面登录
                    console.log('无时间戳登录');
                    const loginTimestamp = String(new Date().getTime());
                    const oldClient = this._getClient(connectInfo.socketId);
                    oldClient && (oldClient.emit('forceLogout'));
                    this._setUserLoginInfo({...data, socketId, loginTimestamp });
                    return {
                        status: 1,
                        loginTimestamp
                    }
                } else if(data.loginTimestamp === connectInfo.loginTimestamp) {
                     // 重复登录 时间戳相等
                    console.log('时间戳相等登录');
                    this._setUserLoginInfo({...data, socketId });
                    return {
                        status: 1,
                    }
                } else {
                     // 重复登录 时间戳不登，显示重新登录
                    return {
                        status: -1,
                    }
                }
            }
        } else {
            return {
                status: 0,
                message: '认证出错, 请重新登录',
            }
        }
    }

    // 被顶上去后重新登录
    @SubscribeMessage('WrapLogin')
    async onWrapLogin(client: Client, data: onConnect) {
        try {
            const oldLoginInfo: any = await this._getUserLoginInfo(data.userId);
            if(oldLoginInfo) {
                const loginTimestamp = String(new Date().getTime());
                const oldClient = this._getClient(oldLoginInfo.socketId)
                if(oldClient) {
                    oldClient.emit('forceLogout');
                }
                await this._setUserLoginInfo({ ...data, loginTimestamp, socketId: client.id });
                return {
                    status: 1,
                }
            } else {
                throw new Error('登录失败');
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
            }
        }
    }

    private async _setUserLoginInfo(connectInfo: onConnect) {
        if(connectInfo && connectInfo.userId) {
            return await this.redis.HMSET(this.redisHelper.WithRedisNameSpace(`USER:${connectInfo.userId}`), connectInfo);
        } else {
            return false;
        }
       
    }
    
    private async _getUserLoginInfo(userId) {
        const key = this.redisHelper.WithRedisNameSpace(`USER:${userId}`);
        if(await this.redis.EXISTS(key)) {
            return await this.redis.HGETALL(key);
        } else {
            return null;
        }
    }
    //-----------单点登录-------------


    
    
    
    @SubscribeMessage('disconnected')
    async onDisconnect(client: Client, data: onConnect) {
    }
    
    @SubscribeMessage('newMessage')
    async reveiveNewMessage(client: Client, msg: Message) {
        const { type, data } = msg;
        console.log('新消息',msg);
        if(type === 'chat') {
            const res = await this.socketService.processChatTypeMsg(data);
            return res;
        } else if(type === 'extra') {
            await this.socketService.processExtraTypeMsg(data);
            return {
                status: 1,
            }
        }
        
    }
}

