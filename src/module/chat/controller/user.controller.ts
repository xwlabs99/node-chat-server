import { Injectable, Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, Req, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from '../service/user.service';
import { join } from 'path';
import { User } from '../interface/model.interface';
import { Redis } from '../../../provider/redis.provider';
import { GroupService } from '../service/group.service';
import { FriendService } from '../service/friend.service';
const fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);
const deleteFile = util.promisify(fs.unlink);
@Controller('chat')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly groupService: GroupService,
        private readonly friendService: FriendService,
        private readonly redis: Redis,
    ){}

    @Get('user/logout/:id')
    async userLogout(@Param() userId) {
        this.userService.userLogout(Number(userId));
        return {
            status: 1,
        }
    }

    @Post('user/info')
    async createUserInfo(@Body() body) {
        const userInfo = body;
        const result = await this.userService.createUser(userInfo);
        if(result.status === 1) {
            return {
                status: 1,
                data: result.data,
            }
        } else {
            return {
                status: 0,
                message: result.message,
            }
        }
    }


    // 需要缓存
    @Get('user/info/:id')
    async getUserInfo(@Param('id') targetId: number, @Body('authorization') auth) {
        try {
            const { id: userId } = auth;
            const result = await Promise.all([
                this.userService.getOneUserInfo(targetId),
                this.friendService.findFriendInfo(userId, targetId)
            ]);
            if(result) {
                return {
                    status: 1,
                    data: {
                        info: result[0],
                        friend: result[1],
                    },
                }
            } else {
                throw new Error('找不到用户');
            }
        } catch (err) {
            console.log(err.message);
            return {
                status: 0,
                message: err.message,
            }
        }
    }

    @Put('user/info/:id')
    async updateUserInfo(@Param('id') userId, @Body() userInfo: User) {
        try {
            const result = await this.userService.updateUser(userId, userInfo);
            if(result) {
                return {
                    status: 1,
                    data: result,
                }
            }
            throw new Error('未找到用户');
        } catch(err) {
            return {
                status: 0,
                message: err.message,
            }
        }
    }

    @Post('user/avatar/upload/:id')
    @UseInterceptors(FileInterceptor('file',{ dest: join('..', 'static/avatar') }))
    async uploadAvatar(@Req() req, @Param('id') userId) {
        try {
            const userInfo = await this.userService.getOneUserInfo(userId, );
            if(userInfo) {
                // 删除原有文件
                const { path, originalname } = req.file;
                const fileName = `${userId}:${new Date().getTime()}` + '.' +originalname.split('.')[1];
                const err = await rename(join(path), join('..', 'static/avatar', fileName));
                if(err) {
                    throw new Error('更新出错');
                }
                if(userInfo.avatar && userInfo.avatar.length !== 0) {
                    const err = await deleteFile(join('..', 'static/avatar', userInfo.avatar));
                }
                this.userService.updateUser(userId, { avatar: fileName });
                return {
                    status: 1,
                    data: {
                        avatar: fileName,
                    }
                }
            } else {
                throw new Error('找不到用户');
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }      
    }

    @Get('user/muiltinfo')
    async getMuiltUserInfo(@Query('uid') userIds) {
        try {
            const result = await this.userService.getMuiltUserBaseInfo(userIds, [ 'name' ]);
            if(result) {
                return result;
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
      
    }

    @Get('user/group/:id')
    async getUserGroupList(@Param('id') userId) {
        try {
            const UserGroupList = await this.groupService.getUserGroupList(userId);
            return {
                status: 1,
                data: UserGroupList
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message
            }
        }
    }

}
