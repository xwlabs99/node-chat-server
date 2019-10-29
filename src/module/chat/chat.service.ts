import { Injectable, HttpException, Inject, forwardRef } from '@nestjs/common';
import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { UserService } from './service/user.service';
import { MessageService } from './service/message.service';
import { GroupService } from './service/group.service';
import { FriendService } from './service/friend.service';
import { Message } from './interface/model.interface';
import { PushGateway } from '../push/push.gateway';
const reg = new RegExp('\\/\\{[a-zA-Z_]{1,14}\\}', 'g');
interface sendOptions {
    checkPermission? : boolean 
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
            const { groupId, userId } = msg;
            const res = await this.sendMessageToGroup(userId, groupId, msg);
            return res;
                
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
            })
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
                            status: -2,
                        }
                    }
                    msgContent = `${senderInfo.alias}:${msgContent}`;
                }
            }

            const isAutoMsg = msgContent.includes('[自动消息]');
            const pushTargets = (await Promise.all(receivers.map(async (receiver) => {
                const pushToken = await this.sendMessageToClient(receiver.userId, msg);
                if(receiver.ignoreAllMsg) {
                    return null;
                } else if(isAutoMsg && receiver.ignoreAutoMsg) {
                    return null;
                } else {
                    return pushToken;
                }
            }))).filter(pushToken => pushToken);

            this.pushService.sendPushToMuilt(pushTargets, groupName, msgContent);
            return {
                status: 1,
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
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

    async sendSystemMessageToOne(groupId:string, targetUserId: number, content: string, payload?: object) {
        if(!payload) {
            payload = { type: 'normal' };
        }
        const userId = 0;
        const newSendSystemMessage = {
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
        };
        this.sendMessageToClient(targetUserId, newSendSystemMessage);
    }

    async processExtraTypeMsg(msg) {
        const { name, data } = msg;
        if(name === 'sendFriendInvitation') {
            const { targetUserId, userId, tips } = data;
            console.log('新好友申请', data);
            const { name: userName }: any  = await this.userService.getRedisUserInfo(userId, [ 'name' ]);
            this.sendSystemMessageToOne('friendInvite', targetUserId, `${userName} 请求添加您为好友`, {
                type: 'friendInvitation', 
                userId: userId,
                tips,
            });
        }
    }
}