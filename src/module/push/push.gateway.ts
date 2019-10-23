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
const Xiaomi = require('push-xiaomi');
const Huawei = require('push-huawei');
const APNs = require('./lib/push-ios.js');

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
    XiaomiPushClient;
    HuaweiPushClient;
    APNsPushClient;

    constructor(
        @InjectModel('PushUser') private readonly pushUserModel: Model<PushUser>,
        private readonly redis: Redis,
    ){
        this.XiaomiPushClient = new Xiaomi({
            appId: '2882303761518040120',
            appSecret: 'x/R1mbG/TtXlgbAmTpE8VA==',
            appPkgName: 'com.swiftbarbird',
        });
        this.HuaweiPushClient = new Huawei({
            appId: '100874921',
            appSecret: '8effb3f4934b550b0d7a637cd5c323ab0a222ffa18e7c558d72577ba3bc57088',
            appPkgName: 'com.swiftbarbird',
        });
        this.APNsPushClient = new APNs({
            cert: __dirname + '/cert_dev.pem',
            key: __dirname + '/key_dev.pem',
            passphrase: 'weixiang1999', // pem证书密码
            production: false,  // 是否生产环境
            topic: 'com.util.bailingbird'
        });
    }

    private _getClient(socketId: string): Socket {
        return this.server.sockets.sockets[socketId];
    }

    async sendPushToOne(pushId: string, title: string, content: string) {

    }

    async offlinePush(type ,tokens: string[], title, content) {
        if(type === 'MIPush') {
            this.XiaomiPushClient.push({
                title: title,
                content: content,
                list: tokens, 
                sleep: 0, // 请求间隔时间/毫秒
                success(res){}, // 成功回调
                error(err){}, // 失败回调
                finish(){} // 所有请求回调
            });
        } else if(type === 'HuaweiPush') {
            this.HuaweiPushClient.push({
                title: title,
                content: content,
                list: tokens, 
                sleep: 0, // 请求间隔时间/毫秒
                extras: {
                },
                success(res){}, // 成功回调
                error(err){}, // 失败回调
                finish(){} // 所有请求回调
            });
        } else if(type === 'ios') {
            console.log('推送Ios', tokens);
            this.APNsPushClient.push({
                title: title,
                content: content,
                list: tokens,
                sleep: 0, // 请求间隔时间/毫秒
                success(res) {
                    console.log("发送成功", res);
                },
                false(err) {
                    console.log("发送失败", err);
                },
                finish(res){
                    console.log("发送完成", res);
                  // 所有请求完成回调
                }
            });
        }
        
    }


    async sendPushToMuilt(pushIds: string[], title: string, content: string) {
        const pushTargetInfos = await this.pushUserModel.find({
            _id: pushIds,
        }).exec();
        console.log('准备推送', pushIds, pushTargetInfos);
        const MiPush = [];
        const HuaweiPush = [];
        const ApnsPush = [];
        pushTargetInfos.forEach(pushTarget => {
            if(pushTarget.extraPushType === 'ios') {
                ApnsPush.push(pushTarget.extraPushToken);
                return true;
            }
            const client = this._getClient(pushTarget.socketId);
            if(client) {
                client.emit('newMessage', { title, content });
            } else {
                if(pushTarget.extraPushType === 'MIPush') {
                    MiPush.push(pushTarget.extraPushToken);
                } else if(pushTarget.extraPushType === 'HuaweiPush') {
                    HuaweiPush.push(pushTarget.extraPushToken);
                }
                console.log('调用第三方推送')
            }
        });
        this.offlinePush('MIPush', MiPush, title, content);
        this.offlinePush('HuaweiPush', HuaweiPush, title, content);
        this.offlinePush('ios', ApnsPush, title, content);
    }

    @SubscribeMessage('onConnect')
    async onConnect(client: Client, data: PushConnect) {
        const { pushToken, extraPushToken, extraPushType, socketId } = data;
        const findUser = await this.pushUserModel.findById(pushToken).exec();
        findUser.extraPushToken = extraPushToken;
        findUser.extraPushType = extraPushType;
        findUser.socketId = socketId;
        const res = await findUser.save();
        return {
            status: 1,
        }
    }

}

