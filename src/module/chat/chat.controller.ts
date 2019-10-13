import { Injectable, Controller, Get, Post, Put, Delete, Body } from '@nestjs/common';
import { UserService } from './service/user.service';
@Controller('chat')
export class ChatController {
    constructor(
        private readonly userService: UserService,
    ){}

    @Post()
    async createUserInfo(@Body('data') body, @Body('authorization') auth) {
        console.log(auth);
    }

    @Get()
    async getChatServiceConfig(@Body('authorization') auth) {
        return {
            pushHost: 'http://192.168.1.104:8001',
            chatHost: 'http://192.168.1.104:8000',
            updateHost: 'http://47.106.153.116:3000',
        }
    }
}
