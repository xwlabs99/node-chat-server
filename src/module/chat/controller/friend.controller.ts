import { Injectable, Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { FriendService } from '../service/friend.service';
import { UserService } from '../service/user.service';


@Controller('chat')
export class FriendController {
    constructor(
        private readonly friendService: FriendService,
        private readonly userService: UserService,
    ){}

    //获取用户好友列表
    @Get('friend/:id')
    async getFriendList(@Param('id') userId) {
        try {
            const result = await this.friendService.getFriendListMember(userId);
            if(result.status === 1) {
                return {
                    status: 1,
                    data: result.data
                }
            } else {
                return {
                    status: 0,
                    message: '查询失败',
                }
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message,
            }
        }
        
    }

    //添加好友
    @Post('friend')
    async addToFriendList(@Body() data): Promise<object> {
        try {
            const { userId, targetUserId } = data;
            if(!userId || !targetUserId) {
                throw new Error('缺少必要参数');
            }
            const addFriend = await this.friendService.addFriendListMember(userId, targetUserId);
            return {
                status: 1,
                data: addFriend
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
    }

    //删除好友
    @Delete('friend')
    async deleteFromFriendList(@Body() data): Promise<object> {
        try {
            const { userId, targetUserId } = data;
            await this.friendService.moveFriendListMember(userId, targetUserId);
            return {
                status: 1,
                message: '删除好友成功',
            }
        } catch(err) {
            return {
                status: 0,
                message: '删除好友失败',
            }
        }
    }

       //添加好友
    @Put('friend')
    async updateFriendInfo(@Body() data): Promise<object> {
        try {
            const { userId, targetUserId, newInfo } = data;
            if(!userId || !targetUserId || !newInfo) {
                throw new Error('缺少必要参数');
            }
            const addFriend = await this.friendService.updateFriendInfo(userId, targetUserId, data);
            return {
                status: 1,
                // data: addFriend
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
    }
}
