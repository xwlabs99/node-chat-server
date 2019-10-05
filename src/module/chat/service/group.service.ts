import { Injectable, OnModuleInit } from '@nestjs/common';
import { Group, GroupMember, UserGroupItem, UserGroupList } from '../interface/model.interface';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { UserService } from './user.service';


@Injectable()
export class GroupService implements OnModuleInit {
    constructor(
        @InjectModel('Group') private readonly groupModel: Model<Group>,
        @InjectModel('GroupMember') private readonly groupMemberModel: Model<GroupMember>,
        @InjectModel('GroupList') private readonly groupListModel: Model<UserGroupList>,
        @InjectModel('GroupItem') private readonly userGroupModel: Model<UserGroupItem>,
        private readonly redisHelper: RedisHelper,
        private readonly userService: UserService,
        private readonly redis: Redis,
       
    ){}
    onModuleInit() {
        /*
        this.createGroup(0, 'friendInvite', '新的好友', 'system');    
        this.updateGroupInfo('friendInvite', {
            avatar: JSON.stringify({
                name: 'md-person-add',
                type: 'ionicon',
                color: '#FFCC33',
            }) 
        });
        */
    }

    async createGroup(createrId: number, groupId: string, name: string, type: string) {
        const group = await this.groupModel.findOne({ groupId }).exec();
        if(group) {
            throw new Error('该ID已经存在');
        } else {
            const newGroup = new this.groupModel({ groupId, name, type, createrId });
            const group = await newGroup.save();
            return group;
        }
    }

    async getGroupBaseInfo(groupId: string | string[]): Promise<Group[]> {
        const group = await this.groupModel.find({ groupId }, [ 'type', 'name', 'groupId', 'avatar', 'type' ]).exec();
        if(group) {
            return group;
        } else {
            throw new Error('未找到群聊信息');
        }
    }  

    async getOneGroupAllInfo(groupId: string): Promise<Group> {
        const group = await this.groupModel.findOne({ groupId }).exec();
        if(group) {
            return group;
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
            if(group) {
                // if(!this._hasPermission(operaterId, group)) {
                //     throw new Error('你没有邀请群成员的权限');
                // }
                const groupMembers = group.members;
                const filterMembers = memberIds.filter(userId => (groupMembers.findIndex(member => member.userId === userId) === -1));
                if(filterMembers.length === 0) {
                    throw new Error('要添加的成员均在群中');
                }
                const userInfos = await this.userService.getMuiltUserBaseInfo(filterMembers, [ 'name', 'userId' ]);
                const newMembers = userInfos.map(userInfo => 
                    new this.groupMemberModel({ 
                        alias: userInfo.name, 
                        userId: userInfo.userId 
                    })
                );
    
                group.members.concat();
                const save = await group.save();
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
            if(group) {
                if(!this._hasPermission(operaterId, group)) {
                     throw new Error('你没有删除群成员的权限');
                }
                const groupMembers = group.members;
                const filterMembers = groupMembers.filter(member => {
                    return memberIds.findIndex(userId => member.userId === userId) === -1;
                });
                group.members = filterMembers;
                return await group.save();
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
        result.groups.concat(addedGroups);
        return await result.save();
    }
}