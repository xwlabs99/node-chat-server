import { Injectable, Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, Req, Query } from '@nestjs/common';
import { AuthService } from '../service/authority.service';

@Controller('chat')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ){}

    @Put('auth/:id')
    async updateGroupAuth(@Param('id') groupId, @Body('data') authChange, @Body('authorization') auth) {
        try {
            if(!authChange) {
                throw new Error('缺少信息');
            }
            if(Object.keys(authChange).length === 0) {
                throw new Error('没有要保存的信息');
            }
            
            const { id: operatorId } = auth;
            const res = await this.authService.updateUserAuthorityInGroup(operatorId, groupId, authChange);
            if(res) {
                return {
                    status: 1,
                    data: res,
                }
            } else {
                return {
                    status: 0,
                    message: '出现错误',
                }
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message,
            }
        }
    }

    @Get('auth/:id')
    async getGroupAuth(@Param('id') groupId, @Body('authorization') auth) {
        try {
            const { id: operatorId } = auth;
            const res = await this.authService.getGroupAuth(operatorId, groupId);
            if(res) {
                return {
                    status: 1,
                    data: res
                }
            } else {
                return {
                    status: 0,
                    message: '出现错误',
                }
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message,
            }
        }
    }
}
