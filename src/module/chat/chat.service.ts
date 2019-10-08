import { Injectable, HttpException, Inject, forwardRef } from '@nestjs/common';
import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { UserService } from './service/user.service';
import { MessageService } from './service/message.service';
import { GroupService } from './service/group.service';
import { FriendService } from './service/friend.service';
import { Message } from './interface/model.interface';

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
    ){}
    
    async initUserInfo(userId: number, name: string) {
        console.log("初始化用户信息");
        return await this.userService.createUser({ userId, name, avatar: '' });
    }

    private async _getClient(userId: number): Promise<Socket> {
        const { socketId }: any  = await this.userService.getRedisUserInfo(userId, [ 'socketId' ]);
        return this.server.sockets.sockets[socketId];
    }

    async confirmReceive(userId: number, messageId: string) {
        return await this.messageService.removeMsgs(userId, [ messageId ]);
    }

    async processChatTypeMsg(msg: Message) {
        try {
            const { groupId, userId } = msg;
            const res = await this.sendMessageToGroup(userId, groupId, msg);
            return res;
                
        } catch(err) {
            return { status: 0 }
        }
    }

    async sendMessageToClient(userId: number, msg) {
        const client = await this._getClient(userId);
        this.messageService.addToMsgList(userId, msg);
        if(client) {
            client.emit('newMessage', msg);
            return undefined;
        }
    }

    async sendMessageToGroup(senderId: number, groupId: string, msg, options?: sendOptions) {
        try {
            const { checkPermission = true } = options || {};
            const { members, groupType } = await this.groupService.getOneGroupAllInfo(groupId);
            const receivers = members.filter(member => member.userId !== senderId);
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
                } else {
                    if(receivers.length === members.length) {
                        return {
                            status: -2,
                        }
                    }
                }
            }
           

            receivers.forEach(member => {
                if(senderId!== member.userId) {
                    this.sendMessageToClient(member.userId, msg);
                }
            })
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

    async sendSystemMessageToGroup(gid: string, content: string, payload: object) {
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

    async sendSystemMessageToOne(groupId:string, targetUserId: number, content: string, payload: object) {
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
        }/* else if(name === 'newGroupInvitation') {
            const { groupId, userId, groupType } = data;
            console.log('创建群聊, 发通知', data);
            const { name: userName }: any  = await this.userService.(userId, [ 'name' ]);
            this.sendNormalGroupSystemMessage(
                groupId, 
                `${userName}创建了${groupType === 'store' ? '门店': '群聊'}`, 
                { type: 'normal' },
            );
        } else if(name === 'changeGroupMember') {
            const { userId, isAdd, groupId } = data;
            console.log('移出或加入群聊, 发通知', data);
            if(isAdd) {
                const { userId, groupId, members } = data;
                const { name } = await this.userService.getOneUserInfo(userId, ['name']);
                const nameArray = await Promise.all(members.map(async uid => await this.chatUserService.getInfoOneField(uid, 'name')));
                const nameString = nameArray.join(',');
                console.log(nameString);
                this.sendNormalGroupSystemMessage(
                    groupId,
                    `${name}邀请了 ${nameString} 进入该群`,
                    { type: systemMsgType.normal },
                );
            } else {
                const { targetUserId } = data;
                const name = await this.chatUserService.getInfoOneField(userId, 'name');
                this.sendNormalGroupSystemMessageToOne(
                    groupId, 
                    targetUserId, 
                    `你已经被${name}移出本群`,
                    { type: systemMsgType.normal },
                );
            }
        } else {

        }*/
    }
}