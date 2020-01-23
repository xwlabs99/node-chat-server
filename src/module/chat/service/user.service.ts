import { Injectable, HttpException, OnModuleInit } from '@nestjs/common';
import { User, UserFriendList, UserGroupList } from '../interface/model.interface';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ServiceResult } from '../interface/service.interface';
import { Redis } from '../../../provider/redis.provider';
import { RedisHelper } from '../helper/redisHelper.provider';

@Injectable()
export class UserService implements OnModuleInit {
    constructor(
        @InjectModel('User') private readonly userModel: Model<User>,
        @InjectModel('FriendList') private readonly friendListModel: Model<UserFriendList>,
        @InjectModel('GroupList') private readonly groupListModel: Model<UserGroupList>,
        private readonly redisHelper: RedisHelper,
        private readonly redis: Redis,
    ){}

    async onModuleInit() {
        const addSystemUser = async (userId, name, avatar) => {
            const u = await this.userModel.findOneAndUpdate({ userId }, {
                name, avatar: JSON.stringify(avatar)
            }).exec();
            if(u) {
                return;
            } else {
                const newUser = new this.userModel({
                    userId,
                    type: 'system',
                    name: name,
                    avatar: JSON.stringify(avatar)
                });
                await newUser.save();
            }
        } 
        try {
            addSystemUser(-1, '提醒助手', {
                name: 'ios-notifications',
                type: 'ionicon',
                color: '#FFCC33',
            });
        } catch(err) {
            return;
        }
    }

    async createUser(userInfo: any): Promise<ServiceResult> {
        const { userId, name } = userInfo;
        if(!userId || !name) {
            return { status: 0, message: '缺少参数' };
        }
        try {
            const user = await this.userModel.findOne({ userId }).exec();
            if(user) {
                return { status: 0, message: '该用户ID已存在' };
            } else {
                const newUser = new this.userModel(userInfo);
                const user: User = await newUser.save();
                console.log(userId);
                const newUserFriendList = new this.friendListModel({ userId: userId });
                const newUserGroupList = new this.groupListModel({ userId: userId });
                await newUserFriendList.save();
                await newUserGroupList.save();
                return {
                    status: 1,
                    data: user,
                };
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: '创建用户失败',
            }
        }
    }


    async getRedisUserInfo(userId: number, fields: string[]) {
        const key = this.redisHelper.WithRedisNameSpace(`USER:${userId}`)
        if(await this.redis.EXISTS(key)) {
            return await this.redis.HMGET(
                key, 
                fields
            );
        } else {
            return null;
        }
        
    }
    
    async updateUser(userId: number, userInfo: User | object): Promise<User> {
        try {
            const result: User = await this.userModel.findOneAndUpdate(
                { userId },
                userInfo,
            ).exec();
            if(!result) {
                throw new Error('找不到用户');
            }
            return result;
        } catch(err) {
            throw new Error(err.message);
        }
    }

    async getMuiltUserBaseInfo(userIds: number[], fields?: string[]): Promise<User[]> {
        if(!Array.isArray(userIds)) {
            throw new Error('查询参数不是数组');
        }
        const result: User[] = await this.userModel.find({ userId: userIds }, fields).exec();
        return result;
    }

    // 可以缓存
    async getSystemUserBaseInfo(): Promise<User[]> {
        const result: User[] = await this.userModel.find({ 
            userId: { $lt: 0 }
        }).exec();
        return result;
    }

    async getOneUserInfo(userId: number, fields? : string[]): Promise<User> {
        const result: User = await this.userModel.findOne({ userId }, fields).exec();
        return result;
    }
 
    async userLogout(userId) {
        return await this.redis.DEL(this.redisHelper.WithRedisNameSpace(`USER:${userId}`));
    }
}