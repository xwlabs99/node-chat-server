import { Injectable, Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PushUser } from './push.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';


@Controller('push')
export class PushController {
    constructor(
        @InjectModel('PushUser') private readonly pushUserModel: Model<PushUser>,
    ){}


    @Get('token')
    async getToken(@Query('token') pushToken) {
        try {
            console.log(pushToken);
            if(pushToken && pushToken.length !== 0) {
                const findPushUser = await this.pushUserModel.findById(pushToken).exec();
                if(findPushUser) {
                    console.log('该token已经存在');
                    return { pushToken: findPushUser._id } 
                } else {
                    console.log('创建新用户');
                    const pushUser = new this.pushUserModel({});
                    const newPushUser = await pushUser.save();  
                    return { pushToken: newPushUser._id };
                }
            } else {
                console.log('创建新用户');
                const pushUser = new this.pushUserModel({});
                const newPushUser = await pushUser.save();  
                return { pushToken: newPushUser._id };
            } 
        } catch(err) {
            console.log(err);
        }
    }

    @Put('token')
    async updateInfo(@Body('data') info) {
        try {
            const { extraPushType, extraPushToken, pushToken } = info;
            console.log("1234", info);
            if(pushToken && pushToken.length !== 0) {
                const findPushUser = await this.pushUserModel.findById(pushToken).exec();
                if(findPushUser) {
                    findPushUser.extraPushToken = extraPushToken;
                    findPushUser.extraPushType = extraPushType;
                    findPushUser.save()
                    return { pushToken: findPushUser._id } 
                } else {
                    return { pushToken: null }
                }
            }
        } catch(err) {
            console.log(err);
        }
    }
}
