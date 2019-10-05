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
}
