import { Injectable, Controller, Get, Post, Put, Delete, Body } from '@nestjs/common';
import { UserService } from './service/user.service';
import { ChatService } from './chat.service';
@Controller('chat')
export class TestController {
    constructor(
        private readonly userService: UserService,
        private readonly chatService: ChatService,
    ){}

    @Post()
    async createUserInfo(@Body('data') body, @Body('authorization') auth) {
        console.log(auth);
    }

    @Get()
    async getChatServiceConfig(@Body('authorization') auth) {

    }
}
