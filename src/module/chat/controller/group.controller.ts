import { Injectable, Controller, Get, Post, Body, Query, Param, Put } from '@nestjs/common';
import { GroupService } from '../service/group.service';
import { UserService } from '../service/user.service';
const moment = require('moment');
@Controller('chat/group')
export class GroupController {
    constructor(
      private readonly groupService: GroupService,
      private readonly userService: UserService,
    ){}

    @Post()
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
            return {
                status: 0,
                message: err.message
            }
        }
    }

    @Get()
    async getGroupInfo(@Query() data) {
        try {
            const { groupId } = data;
            if(!groupId) {
                throw new Error('缺少必要参数');
            }
            const query = this.groupService.getOneGroupAllInfo(groupId);
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

    @Get(':id')
    async getGroupBaseInfo(@Param('id') gid, @Body('authorization') auth) {
        try {
            const groupInfo = await this.groupService.getGroupBaseInfo([ gid ]);
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

    @Put(':id')
    async updateGroupInfo(@Param('id') gid, @Body('data') newInfo) {
        
    }
}
