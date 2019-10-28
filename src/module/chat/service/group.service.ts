import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Group, GroupMember, UserGroupItem, UserGroupList, User } from '../interface/model.interface';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { UserService } from './user.service';
import { ChatService } from '../chat.service';


@Injectable()
export class GroupService implements OnModuleInit {
    constructor(
        @InjectModel('Group') private readonly groupModel: Model<Group>,
        @InjectModel('GroupMember') private readonly groupMemberModel: Model<GroupMember>,
        @InjectModel('GroupList') private readonly groupListModel: Model<UserGroupList>,
        @InjectModel('GroupItem') private readonly userGroupModel: Model<UserGroupItem>,
        private readonly redisHelper: RedisHelper,
        private readonly userService: UserService,
        @Inject(forwardRef(() => ChatService))
        private readonly chatService: ChatService,
        private readonly redis: Redis,
       
    ){}
    
    async onModuleInit() {
        try {
            await this.createGroup(0, 'friendInvite', '新的好友', 'system').then(() => {
                this.updateGroupInfo('friendInvite', {
                    avatar: JSON.stringify({
                        name: 'md-person-add',
                        type: 'ionicon',
                        color: '#FFCC33',
                    }) 
                });
            });  
            await this.createGroup(1, 'groupHelper', '群助手', 'system').then(() => {
                this.updateGroupInfo('groupHelper', {
                    avatar: JSON.stringify({
                        name: 'md-people',
                        type: 'ionicon',
                        color: '#FFCC33',
                    }) 
                });
            });  
        } catch(err) {
            return;
        }
    }

    async createGroup(createrId: number, groupId: string, groupName: string, groupType: string) {
        const group = await this.groupModel.findOne({ groupId }).exec();
        if(group) {
            throw new Error('该ID已经存在');
        } else {
            const newGroup = new this.groupModel({ groupId, groupName, groupType, createrId });
            const group = await newGroup.save();
            return group;
        }
    }

    async getGroupBaseInfo(groupId: string | string[]): Promise<Group[]> {
        const group = await this.groupModel.find({ groupId }, [ 'type', 'groupName', 'groupId', 'avatar', 'groupType' ]).exec();
        if(group) {
            return group;
        } else {
            throw new Error('未找到群聊信息');
        }
    }  

    async getOneGroupAllMemberInfo(groupId: string): Promise<Group> {
        try {
            const key = this.redisHelper.WithRedisNameSpace(`GMember:${groupId}`);
            if(false && await this.redis.EXISTS(key)) {
                const groupMemberIds: string[] = await this.redis.SMEMBER(key);
                const groupMemberInfo: any = await Promise.all(groupMemberIds.map(async (groupMemberId) => {
                    return await this.redis.HGETALL(this.redisHelper.WithRedisNameSpace(`gmember:${groupMemberId}`));
                }));
                return groupMemberInfo;
            } else {
                const group = await this.groupModel.findOne({ groupId }).exec();
                return group;
            }
        } catch(err) {
            throw new Error(err.message);
        }
        
       
    }

    async getOneGroupAllInfo(groupId: string): Promise<{ group: Group, userInfos: User[]  }> {
        const group = await this.groupModel.findOne({ groupId }).exec();
        if(group) {
            const userInfos = await this.userService.getMuiltUserBaseInfo(group.members.map(member => member.userId));
            return { group, userInfos };
        } else {
            throw new Error('未找到群聊信息');
        }
    }  

    async updateGroupInfo(groupId: string, newInfo: object): Promise<Group> {
        const group = await this.groupModel.findOneAndUpdate({ groupId }, newInfo).exec();
        if(group) {
            return group;
        } else {
            throw new Error('未找到群聊信息');
        }
    }

    /**
     * @description 向集合中添加元素
     * @param key 键名
     * @returns 返回集合新增成员数
     */
    async addGroupMember(operaterId: number, groupId: string, memberIds: number[]): Promise<GroupMember[]> {
        try {
            const group = await this.groupModel.findOne({ groupId }).exec();
            let operaterInfo: any = group.members.find(member => member.userId === operaterId);
            if(!operaterInfo) {
                const queryUserInfo = await this.userService.getOneUserInfo(operaterId, [ 'name' ]);
                operaterInfo = { alias: queryUserInfo.name, userId: queryUserInfo.userId };
            }
            if(group) {
                // if(!this._hasPermission(operaterId, group)) {
                //     throw new Error('你没有邀请群成员的权限');
                // }
                console.log(group);
                const groupMembers = group.members;
                const filterMembers = memberIds.filter(userId => (groupMembers.findIndex(member => member.userId === userId) === -1));
                if(filterMembers.length === 0) {
                    throw new Error('要添加的成员均在群中');
                }

                const userInfos = await this.userService.getMuiltUserBaseInfo(filterMembers, [ 'name', 'userId' ]);
                const newMembersName = [];
                const newMembers = userInfos.map(userInfo => {
                    newMembersName.push(userInfo.name);
                    return new this.groupMemberModel({ 
                        alias: userInfo.name, 
                        userId: userInfo.userId 
                    })
                });

                group.members = group.members.concat(newMembers);
                const save = await group.save();

                this.chatService.sendSystemMessageToGroup(
                    groupId, 
                    `${operaterInfo.alias}邀请了 ${newMembersName.join(',')} 进入该群`,
                    { type: 'normal' }
                );


                if(!save) {
                    throw new Error('添加群成员失败');
                }
                return newMembers;
            } else {
                throw new Error('未找到群聊信息');
            }
        } catch(err) {
            throw new Error(err.message);
        }
       
    }

    private _hasPermission(userId: number, groupInfo: Group): boolean {
        if(userId === groupInfo.createrId){
            return true;
        }
        const findMember = groupInfo.members.find(member => member.userId === userId);
        if(findMember && (findMember.isAdmin === true)) {
            return true;
        } else {
            return false;
        }
    }

    
    async moveGroupMember(operaterId: number, groupId: string, memberIds: number[]): Promise<Group> {
        try {
            const group = await this.groupModel.findOne({ groupId }).exec();
            const operaterInfo = group.members.find(member => member.userId === operaterId);
            if(group) { 
                const isSelfOperation = (memberIds.length === 1 && memberIds[0] === operaterId);
                if(isSelfOperation ||this._hasPermission(operaterId, group)) {
                    const groupMembers = group.members;
                    const filterMembers = groupMembers.filter(member => {
                        return memberIds.findIndex(userId => member.userId === userId) === -1;
                    });
                    group.members = filterMembers;
                    
                    if(isSelfOperation) {
                        this.chatService.sendSystemMessageToGroup(groupId, `${operaterInfo.alias}退出了群聊`);
                    } else {
                        memberIds.forEach((userId) => {
                            this.chatService.sendSystemMessageToOne(groupId, userId, '你已经被移出群聊');
                        });
                    }
                    return await group.save();
                } else {
                    throw new Error('你没有删除群成员的权限');
                }
                
            } else {
                throw new Error('未找到群聊信息');
            }
        } catch(err) {
            throw new Error(err.message);
        }
    }

    async isUserInGroup(userId: number, groupId: string): Promise<GroupMember | undefined> {
        const group = await this.groupModel.findOne({ groupId }).exec();
        return group.members.find(member => member.userId === userId);
    }

    makeGroupId(createrId: number, groupType: string, { toId, storeId }): string {
        if(!createrId || !groupType) {
            throw new Error('缺少必要参数');
        }
        if(groupType === 'friend') {
            createrId = Number(createrId);
            toId = Number(toId);
            const min = createrId <= toId ? createrId : toId;
            const max = createrId < toId ? toId : createrId;
            return `${min}-${max}`;
        } else if (groupType === 'group'){
            return `${createrId}-${new Date().getTime()}`;
        } else if (groupType === 'store') {
            if(!storeId) {
                throw new Error('缺少必要参数');
            }
            return storeId;
        }
    }

    async getUserGroupList(userId: number): Promise<{ list: UserGroupItem[], groupInfo: Group[] }> {
        const result: UserGroupList = await this.groupListModel.findOne({ userId }).exec();   
        if(!result) {
            throw new Error('找不到用户');
        }
        const groupInfos = await this.getGroupBaseInfo(result.groups.map(group => group.groupId));
        return {
            list: result.groups,
            groupInfo: groupInfos
        };
    }

    async addToUserGroupList(userId: number, groupIds: string[]){
        let result: UserGroupList = await this.groupListModel.findOne({ userId }).exec();
        if(!result) {
            result = new this.groupListModel({ userId });
        }
        groupIds = groupIds.filter(groupId => {
            if(result.groups.findIndex(group => group.groupId === groupId) > -1) {
                return false;
            } else {
                return true;
            }
        })
        const addedGroups = groupIds.map(groupId => new this.userGroupModel({ groupId }));
        result.groups = result.groups.concat(addedGroups);
        return await result.save();
    }

    async moveFromUserGroupList(userId: number, groupIds: string[]){
        let result: UserGroupList = await this.groupListModel.findOne({ userId }).exec();
        if(!result) {
            result = new this.groupListModel({ userId });
        }
        result.groups = result.groups.filter(group => {
            if(groupIds.findIndex(groupId => groupId === group.groupId) > -1) {
                return false;
            } 
            return true;
        });
        return await result.save();
    }
}