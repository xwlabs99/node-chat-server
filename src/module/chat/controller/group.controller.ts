import { Injectable, Controller, Get, Post, Body, Query, Param, Put } from '@nestjs/common';
import { GroupService } from '../service/group.service';
import { UserService } from '../service/user.service';
import { Group } from '../interface/model.interface';

@Controller('chat')
export class GroupController {
    constructor(
      private readonly groupService: GroupService,
      private readonly userService: UserService,
    ){}

    @Post('group')
    async createOrEnterGroup(@Body('data') data, @Body('authorization') auth) {
        try {
            const { groupType, toId, storeId } = data;
            let { id: createrId } = auth;
            const createGroupId = this.groupService.makeGroupId(createrId, groupType, { storeId, toId });
    
            if(groupType === 'friend') {
                const findGroup = await this.groupService.getGroupBaseInfo(createGroupId);
                if(findGroup.length !== 0) {
                    console.log('该群已经存在');
                    return {
                        status: 1,
                        data: {
                            groupId: createGroupId,
                        }
                    }
                }
                const res_createGroup = await this.groupService.createGroup(createrId, createGroupId, createGroupId, 'friend');
                const groupMembersInfo = await this.groupService.addGroupMember(createrId, createGroupId, [ createrId, toId ]);
                console.log('创建聊天组状态', res_createGroup);
                console.log('添加成员', groupMembersInfo);
                if(res_createGroup){
                    return {
                        status: 1,
                        data: {
                            groupId: createGroupId,
                        }
                    }
                }
            } else if (groupType === 'group'){
                const { groupMember } = data;
                const initMemberIdArray = [ createrId, ...groupMember ];
                const groupName = '群聊' + createGroupId;
                const res_createGroup = await this.groupService.createGroup(createrId, createGroupId, groupName, 'group');
                const res_addMemebersNum = await this.groupService.addGroupMember(createrId, createGroupId, initMemberIdArray);
                initMemberIdArray.forEach(userId => {
                    this.groupService.addToUserGroupList(userId, [ createGroupId ]);
                })
                console.log('创建聊天组状态', res_createGroup);
                console.log('添加成员', res_addMemebersNum);
                if(res_createGroup){
                    return {
                        status: 1,
                        data: {
                            groupId: createGroupId,
                            groupName,
                            groupType: 'group',
                        }
                    }
                }
            } else if (groupType === 'store') {
                const { groupMember } = data;
                const groupName = '新建门店'+ new Date().getTime();
                const initMemberIdArray = [ createrId, ...groupMember];
                const res_createGroup = await this.groupService.createGroup(createrId, createGroupId, groupName, 'store');
                const res_addMemebersNum = await this.groupService.addGroupMember(createrId, createGroupId, initMemberIdArray);
                initMemberIdArray.forEach(userId => {
                    this.groupService.addToUserGroupList(userId, [ createGroupId ]);
                })
                console.log('创建门店聊天组状态', res_createGroup);
                console.log('添加成员', res_addMemebersNum)
                if(res_createGroup){
                    return {
                        status: 1,
                        data: {
                            groupId: createGroupId,
                            groupName,
                            groupType: 'store',
                        }
                    }
                }
            }

        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message
            }
        }
    }

    @Get('group/:id')
    async getGroupInfo(@Param('id') groupId, @Body('authorization') auth) {
        const { id: queryUserId } = auth;
        try {
            if(!groupId) {
                throw new Error('缺少必要参数');
            }
            const query = await this.groupService.getOneGroupAllInfo(groupId);
            //if(query.group.members.findIndex(member => member.userId === queryUserId) === -1) {
            //    throw new Error('你不在群中，无法查看信息');
            //}
            return {
                status: 1,
                data: query,
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
     
        
    }

    @Get('group')
    async getMuiltGroupBaseInfo(@Query() data, @Body('authorization') auth) {
        const { gids } = data;
        try {
            const groupInfo = await this.groupService.getGroupBaseInfo(gids);
            return {
                status: 1,
                data: groupInfo,
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message,
            }
        }
    }

    @Put('group/:id')
    async updateGroupInfo(@Param('id') groupId, @Body('data') newInfo: any, @Body('authorization') auth) {
        try {
            const { id: userId } = auth;
            const { ignoreAllMsg, ignoreAutoMsg, groupName, alias, announcement } = newInfo;
            const { group: oldInfo } = await this.groupService.getOneGroupAllInfo(groupId);
            if(groupName) {
                oldInfo.groupName = groupName;
                delete newInfo.groupName;
            }
            if(announcement) {
                oldInfo.announcement = announcement;
                delete newInfo.announcement;
            }
            if(ignoreAllMsg !== undefined || ignoreAutoMsg !== undefined || alias !== undefined) {
                const index = oldInfo.members.findIndex(member => member.userId === userId);
                if(index > -1) {
                    oldInfo.members[index] = Object.assign(oldInfo.members[index], newInfo);
                } else {
                    throw new Error('不在群中无法操作');
                }
            }
            return {
                status: 1,
                data: await oldInfo.save(),
            };

        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: '更新失败',
            }
        }
        
    }

    @Post('groupmember/:id')
    async changeGroupMember(@Param('id') gid, @Body('data') body, @Body('authorization') auth) {
        try {
            const { isAdd = true, members } = body;
            const { id: operaterId } = auth;
            console.log(gid, body);
            if(isAdd) {
                const res = await this.groupService.addGroupMember(operaterId, gid ,members);
                members.forEach(uid => {
                    this.groupService.addToUserGroupList(uid, [ gid ]);
                })
                if(res) {
                    return {
                        status: 1,
                    }
                } else {
                    throw new Error('该用户已经在群里');
                }
            } else {
                const res = await this.groupService.moveGroupMember(operaterId, gid, members);
                members.forEach(uid => {
                    this.groupService.moveFromUserGroupList(uid, [ gid ]);
                })
                if(res) {
                    return {
                        status: 1,
                    }
                }
            }
            throw new Error('该用户已经在群里');
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
        
    } 
}
