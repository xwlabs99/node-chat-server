import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
  } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { PushUser } from './push.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Redis } from '../../provider/redis.provider';
import { isString } from 'util';



interface PushConnect {
    extraPushType: string,
    extraPushToken: string,
    socketId: string,
    pushToken: string,
}

@Injectable()
@WebSocketGateway(8001)
export class PushGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        @InjectModel('PushUser') private readonly pushUserModel: Model<PushUser>,
        private readonly redis: Redis,
       
    ){}

    private _getClient(socketId: string): Socket {
        return this.server.sockets.sockets[socketId];
    }

    async sendPushToOne(pushId: string, title: string, content: string) {

    }

    async sendPushToMuilt(pushIds: string[], title: string, content: string) {
        const pushTargetInfos = await this.pushUserModel.find({
            _id: pushIds,
        }).exec();
        console.log('准备推送', pushIds, pushTargetInfos);
        const MiPush = [];
        const HuaweiPush = [];
        pushTargetInfos.forEach(pushTarget => {
            const client = this._getClient(pushTarget.socketId);
            if(client) {
                client.emit('newMessage', { title, content });
            } else {
                console.log('调用第三方推送')
            }
        });
    }

    @SubscribeMessage('confirmConnect')
    async confirmConnect(client: Client, data: PushConnect) {
        console.log(data);
        try {
            const { pushToken, socketId, extraPushToken, extraPushType } = data;
            console.log(socketId);
            if(pushToken && pushToken.length !== 0) {
                const findPushUser = await this.pushUserModel.findByIdAndUpdate(pushToken, { socketId, extraPushToken, extraPushType }, { upsert: true }).exec();
                if(findPushUser) {
                    console.log('该token已经存在');
                    return { pushToken: findPushUser._id } 
                } else {
                    console.log('创建新用户');
                    const pushUser = new this.pushUserModel({ 
                        socketId: client.id, 
                        extraPushToken: extraPushToken, 
                        extraPushType: extraPushType,
                     });
                    const newPushUser = await pushUser.save();
                     
                }
            } else {
                console.log('创建新用户');
                const pushUser = new this.pushUserModel({ 
                    socketId: client.id, 
                    extraPushToken: extraPushToken, 
                    extraPushType: extraPushType,
                 });
                const newPushUser = await pushUser.save();
                return {
                    pushToken: newPushUser._id,
                } 
            } 
        } catch(err) {
            console.log(err);
        }
        
    }

}

