import { Injectable, HttpException, Inject, forwardRef } from '@nestjs/common';
import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { UserService } from './service/user.service';
import { MessageService } from './service/message.service';
import { GroupService } from './service/group.service';
import { FriendService } from './service/friend.service';
import { Message, GroupMember } from './interface/model.interface';
import { PushGateway } from '../push/push.gateway';
import { Redis } from '../../provider/redis.provider';
import { AuthService, AUTH_TYPE } from './service/authority.service';
const reg = new RegExp('\\/\\{[a-zA-Z_]{1,14}\\}', 'g');
interface sendOptions {
    checkPermission? : boolean 
}

const SPECIAL_TIPS_INFO = {
    atMe: {
        pos: 0
    },
    newTask: {
        pos: 1,
    }
}


@Injectable()
@WebSocketGateway()
export class ChatService {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly userService: UserService,
        private readonly messageService: MessageService,
        @Inject(forwardRef(() => GroupService))
        private readonly groupService: GroupService,
        private readonly friendService: FriendService,
        private readonly pushService: PushGateway,
        private readonly authService: AuthService,
        private readonly redis: Redis,
    ){}
    
    async initUserInfo(userId: number, name: string) {
        return await this.userService.createUser({ userId, name, avatar: '' });
    }
    
    getMessageContent (msg: any): string {
        const { messageType, content } = msg;
        console.log(msg);
        switch(messageType){
            case 'voice':
                return '[语音]';
            case 'image':
                return '[图片]';
            case 'order':
                return '[订单]';
            case 'file':
                return '[文件]';
            case 'system':
                return content.text;
            case 'text':
                return content.replace(reg, '[表情]');
            default:
                return content;
        }
    }

    makeSpecialTipsStr(specialArr: string[]) {
        let str = '00000000';
        specialArr.forEach(tip => {
            if(SPECIAL_TIPS_INFO[tip]) {
                str = replacePos(str, SPECIAL_TIPS_INFO[tip].pos, 1); 
            }
        });
        return str;
    }

    private async _getClient(userId: number): Promise<{ client: Socket, pushToken: string }> {
        const userInfo = await this.userService.getRedisUserInfo(userId, [ 'socketId', 'pushToken' ]);
        if(userInfo) {
            const { socketId, pushToken }: any = userInfo;
            return { 
                client: this.server.sockets.sockets[socketId],
                pushToken,
            };
        } else {
            return {
                client: null,
                pushToken: null
            };
        }
    }

    async confirmReceive(userId: number, messageId: string) {
        return await this.messageService.removeMsgs(userId, [ messageId ]);
    }

    async processChatTypeMsg(msg: Message | any) {
        try {
            const { groupId, userId, messageId, messageType } = msg;
            if(await this.redis.EXISTS(`msg:${messageId}:${messageType}`)) {
                return { status: 1 }
            } else {
                await this.redis.SET(`msg:${messageId}:${messageType}`, 1, 8);
                const res = await this.sendMessageToGroup(userId, groupId, msg);
                return res;
            }
            
                
        } catch(err) {
            return { status: 0 }
        }
    }

    async sendMessageToClient(userId: number, msg) {
        const { client, pushToken } = await this._getClient(userId);
        this.messageService.addToMsgList(userId, msg);
        if(client) {
            client.emit('newMessage', msg);
            return null;
        } else {
            return pushToken; // pushtoken为null则说明不在线
        }
    }

    getSendOptions(msg: Message, receivers: GroupMember[]) {
        const isAutoMsg = msg.messageType === 'text' && msg.content.includes('[自动消息]');
        let forcePushUser;
        let contentPrefix;
        let specialTips = undefined;
        if(msg.messageType === 'text' && msg.content.includes('@')) {
            forcePushUser = (msg.content.match(/@[^\s]+\s*/g)|| []).map(s => s.replace(/[@\s]/g, ''));
            contentPrefix = '[有人@我]';
            specialTips = (forcePushUser.length !== 0) && this.makeSpecialTipsStr([ 'atMe' ]);
        } else if(msg.messageType === 'task'){
            forcePushUser = receivers.map(receiver => receiver.alias);
            contentPrefix = '[新通知]';
            specialTips = this.makeSpecialTipsStr([ 'newTask' ]);
        }

        const reveiversInfo = receivers.map(receiver => {
            let shouldPush = false;
            let pushContentPrefix = undefined;
            if(forcePushUser && forcePushUser.includes(receiver.alias)) {
                shouldPush = true;
                pushContentPrefix = contentPrefix;
            } else if(receiver.ignoreAllMsg || (isAutoMsg && receiver.ignoreAutoMsg)){
                shouldPush = false;
            } else {
                shouldPush = true;
            }

            return {
                receiver,
                msg: { ...msg, specialTips }, 
                shouldPush,
                pushContentPrefix,
            }
        });
        return reveiversInfo;
    }

    async sendMessageToGroup(senderId: number, groupId: string, msg: Message | any, options?: sendOptions) {
        try {
            const { checkPermission = true } = options || {};
            let msgContent = this.getMessageContent(msg);


            // 这里加缓存优化
            let { members, groupType, groupName } = await this.groupService.getOneGroupAllMemberInfo(groupId);
            console.log(members);
            let senderInfo;
            const receivers = members.filter(member => {
                if(member.userId !== senderId) {
                    return true;
                } else {
                    senderInfo = member;
                    return false;
                }
            });


            // 检验好友关系或者群成员关系
            if(checkPermission) {
                if(groupType === 'friend') {
                    const isFriend = await this.friendService.checkIsFriend(senderId, receivers[0].userId);
                    console.log(isFriend);
                    if(!isFriend) {
                        return {
                            status: -1,
                        }
                    }
                    groupName = senderInfo.alias;
                } else {
                    if(receivers.length === members.length) {
                        return {
                            status: -2, // 不在群中
                        }
                    }
                    if(checkPermission) {
                        const hasPermission = await this.authService.hasAuthorityInGroup(groupId, senderId, AUTH_TYPE.SEND_MSG);
                        if(hasPermission !== 1) {
                            return {
                                status: -3,
                            }
                        }
                    }
                  
                    msgContent = `${senderInfo.alias}:${msgContent}`;
                }
            }

           

            // 这个函数为msg添加了字段
            const processedReceiverInfoArr = this.getSendOptions(msg, receivers);
            const pushTargetClassifyByPrefix = {};
            await Promise.all(processedReceiverInfoArr.map(async ({ receiver, msg: targetMsg, shouldPush, pushContentPrefix }) => {
                const pushToken = await this.sendMessageToClient(receiver.userId, targetMsg);
                if(shouldPush && pushToken) {
                    if(!pushTargetClassifyByPrefix[pushContentPrefix]) {
                        pushTargetClassifyByPrefix[pushContentPrefix] = [ pushToken ];
                    } else {
                        pushTargetClassifyByPrefix[pushContentPrefix].push(pushToken);
                    }
                }
            }));
            Object.keys(pushTargetClassifyByPrefix).forEach(prefix => {
                this.pushService.sendPushToMuilt(pushTargetClassifyByPrefix[prefix], groupName, prefix + msgContent);
            });
           


            return {
                status: 1,
            }
        } catch(err) {
            console.log(err);
            return {
                status: -4,
            }
        }
    }

    async sendSystemMessageToGroup(gid: string, content: string, payload?: object) {
        if(!payload) {
            payload = { type: 'normal' };
        }
        const userId = 0;
        const newSendSystemMessage = {
            messageId: `${gid}:${userId}:${new Date().getTime()}`,
            messageType: 'system',
            userId,
            groupId: gid,
            time: new Date().getTime(),
            renderTime: true,
            content: {
                text: content,
                ...payload,
            },
            sendStatus: 1,
        };
        this.sendMessageToGroup(userId, gid, newSendSystemMessage, { checkPermission: false });
    }

    async sendNormalMessageToOne(groupId:string, senderId: number, targetUserId: number, type: string, title: string, content: string, options?: { shouldPush: boolean }) {
        if(!options) {
            options = {
                shouldPush: true,
            }
        }

        const newSendMessage: any = {
            messageId: `${groupId}:${senderId}:${new Date().getTime()}`,
            messageType: type,
            userId: senderId,
            groupId: groupId,
            time: new Date().getTime(),
            renderTime: true,
            content: content,
            sendStatus: 1,
        };

        const pushToken = await this.sendMessageToClient(targetUserId, newSendMessage);
        if(pushToken && options.shouldPush) {
            this.pushService.sendPushToOne(pushToken, title, content);
        }
    }

    async sendSystemMessageToOne(groupId:string, targetUserId: number, title: string, content: string, payload?: object, extraMsg?: object, options?: { shouldPush: boolean }) {
        if(!payload) {
            payload = { type: 'normal' };
        }
        if(!options) {
            options = {
                shouldPush: true,
            }
        }

        const userId = 0;
        const newSendSystemMessage: any = Object.assign({
            messageId: `${groupId}:${userId}:${new Date().getTime()}`,
            messageType: 'system',
            userId,
            groupId: groupId,
            time: new Date().getTime(),
            renderTime: true,
            content: {
                text: content,
                ...payload,
            },
            sendStatus: 1,
        }, extraMsg || {});

        const pushToken = await this.sendMessageToClient(targetUserId, newSendSystemMessage);
        if(pushToken && options.shouldPush) {
            this.pushService.sendPushToOne(pushToken, title, content);
        }
    }

    async processExtraTypeMsg(msg) {
        const { name, data } = msg;
        if(name === 'sendFriendInvitation') {
            const { targetUserId, userId, tips } = data;
            console.log('新好友申请', data);
            const { name: userName }: any  = await this.userService.getRedisUserInfo(userId, [ 'name' ]);
            this.sendSystemMessageToOne('friendInvite', targetUserId, '新的好友', `${userName} 请求添加您为好友`, {
                type: 'friendInvitation', 
                userId: userId,
                tips,
            });
        }
    }
}

function replacePos(strObj, pos, replacetext) {
    if(pos !== 0 && !pos) {
        throw new Error('出现错误');
    }
    let str;
    if(pos === 0) {
        str = replacetext + strObj.substring(1);
    } else if(pos === strObj.length - 1){
        str = strObj.substr(0, strObj.length - 1) + replacetext;
    } else {
        str = strObj.substring(0, pos) + replacetext + strObj.substring(pos + 1);
    }
    return str;
}