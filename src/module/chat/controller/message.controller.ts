import { Injectable, Controller, Get, Post, Put, Body, UseInterceptors, Req, Param, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageService } from './message.service';
import { StorageService } from '../../../../service/objectStorage/storage.provider';
import { Message } from './message.interface';
import { join } from 'path';
import bodyParser = require('body-parser');
const fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);
@Controller('chat/message')
export class MessageController {
    constructor(
       private readonly messageService: MessageService,
       private readonly storageService: StorageService
    ){}
    
    @Post('voice/upload')
    @UseInterceptors(FileInterceptor('file',{ dest: join('..', 'static/voice') }))
    async uploadVoice(@Req() req, @Query() query) {
        const { originalname, path } = req.file;
        const err = await rename(join(path), join('..', 'static/voice', originalname));
        console.log('上传文件', err);
        if(err) {
            return {
                status: 0,
            }
        } else {
            return {
                status: 1,
            }
        }
    }

    @Post('image/upload')
    @UseInterceptors(FileInterceptor('file',{ dest: join('..', 'static/image') }))
    async uploadImage(@Req() req, @Query() query) {
        const { originalname, path } = req.file;
        const err = await rename(join(path), join('..', 'static/image', originalname));
        console.log('上传文件', req.file ,err);
        if(err) {
            return {
                status: 0,
            }
        } else {
            return {
                status: 1,
            }
        }
    }

    // 以系统角色发送消息
    @Post('systemcast')
    async systemcast(@Body() body, @Body('auth') auth) {

    }

    // 以用户角色发送消息
    @Post('broadcast')
    async broadcast(@Body() body, @Body('auth') auth) {
        
    }
}
