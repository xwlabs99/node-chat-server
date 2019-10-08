import { Injectable, HttpException } from '@nestjs/common';
import { Friend, UserFriendList, User } from '../interface/model.interface';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ServiceResult } from '../interface/service.interface';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { UserService } from './user.service';



@Injectable()
export class FriendService {
    static CheckFriendExpireTime = 3600;

    constructor(
        @InjectModel('Friend') private readonly friendModel: Model<Friend>,
        @InjectModel('FriendList') private readonly friendListModel: Model<UserFriendList>,
        private readonly redisHelper: RedisHelper,
        private readonly userService: UserService,
        private readonly redis: Redis
    ){}
    
    async addFriendListMember(userId: number, targetUserId: number): Promise<ServiceResult> {
        const isFriend = await this.checkIsFriend(userId, targetUserId);
        userId = Number(userId);
        targetUserId = Number(targetUserId);
        if(!isFriend) {
            console.log('不是好友');
            const [ 
                listArr,
                // userInfoArr,
            ] = await Promise.all([
                this.friendListModel.find({ userId: [ userId, targetUserId ] }),
                // this.userService.getMuiltUserBaseInfo([ userId, targetUserId ]),
            ]);
            console.log(listArr);
            const myFriendList = listArr.find(list => list.userId === userId);
            const targetFriendList = listArr.find(list => list.userId === targetUserId);
            // const userInfoQuery = userInfoArr.find(user => user.userId === userId);
            // const targetUserInfoQuery = userInfoArr.find(user => user.userId === targetUserId);

            if(!myFriendList || !targetFriendList) {
                throw new Error('用户信息缺失');
            }
            const myNewFriendItem = new this.friendModel({ userId: targetUserId });
            const targetNewFriendItem = new this.friendModel({ userId: userId });
            myFriendList.friends.push(myNewFriendItem);
            targetFriendList.friends.push(targetNewFriendItem);
            await this.redis.DEL(this._getIsFriendKey(userId, targetUserId));
            const [ res, res1 ] = await Promise.all([
                myFriendList.save(),
                targetFriendList.save(),
            ]);
            return {
                status: 1,
                data: res,
            }
        } else {
            throw new Error('该用户已经是你的好友');
        }
    }

    async getFriendListMember(userId: number): Promise<ServiceResult> {
        try {
            const list = await this.friendListModel.findOne({ userId });
            if(list) {
                const userIds = list.friends.map(friend => friend.userId);
                const userInfo = await this.userService.getMuiltUserBaseInfo(userIds, [ 'userId', 'name', 'avatar' ]);
                return {
                    status: 1,
                    data: {
                        list: list.friends,
                        userInfo: userInfo
                    },
                }
            } else {
                return {
                    status: 0,
                    message: '没有找到对应的列表',
                }
            }
        } catch(err) {
            throw new Error('出现错误');
        }
    }
    
    async moveFriendListMember(userId: number, targetUserId: number): Promise<ServiceResult> {
        userId = Number(userId);
        targetUserId = Number(targetUserId);
        const [ 
            listArr,
        ] = await Promise.all([
            this.friendListModel.find({ userId: [ userId, targetUserId ] }),
        ]);
        const myFriendList = listArr.find(list => list.userId === userId);
        const targetFriendList = listArr.find(list => list.userId === targetUserId);

        if(!myFriendList || !targetFriendList) {
            throw new Error('用户信息缺失');
        }
        
        myFriendList.friends = myFriendList.friends.filter(friend => friend.userId !== targetUserId);
        targetFriendList.friends = targetFriendList.friends.filter(friend => friend.userId !== userId);
        await this.redis.DEL(this._getIsFriendKey(userId, targetUserId));
        const [ res, res1 ] = await Promise.all([
            myFriendList.save(),
            targetFriendList.save(),
        ]);
        return {
            status: 1,
            data: res,
        }
    }

    //需要缓存
    async checkIsFriend(userId: number, targetUserId: number): Promise<boolean> {
        try {
            targetUserId = Number(targetUserId);
            userId = Number(userId);
        } catch(err) {
            throw new Error(err.message);
        }
       
        const cacheKey = this._getIsFriendKey(userId, targetUserId)
        if(await this.redis.EXISTS(cacheKey)) {
            const isFriend = Number(await this.redis.GET(cacheKey));
            console.log('已经缓存');
            return isFriend === 1 ? true : false;
        } else {
            
            const friendList = await this.friendListModel.findOne({ userId });
            const index = friendList.friends.findIndex(friend => {
                return Number(friend.userId) === Number(targetUserId);
            });
            if(friendList && (index > -1)) {
                this.redis.SET(cacheKey, 1, FriendService.CheckFriendExpireTime);
                return true;
            } else {
                this.redis.SET(cacheKey, 0, FriendService.CheckFriendExpireTime);
                return false;
            }
        }
    }

    async findFriendInfo(userId: number, targetUserId: number): Promise<Friend> {
        try {
            targetUserId = Number(targetUserId);
            userId = Number(userId);
        } catch(err) {
            throw new Error(err.message);
        }

        const friendList = await this.friendListModel.findOne({ userId });
        const findFriend = friendList.friends.find(friend => {
            return Number(friend.userId) === Number(targetUserId);
        });

        if(friendList && findFriend) {
            return findFriend;
        } else {
            return null;
        }
    }

    async getOneFriendInfo(userId: number, targetUserId: number) {
        try {
            targetUserId = Number(targetUserId);
            userId = Number(userId);
        } catch(err) {
            throw new Error(err.message);
        }

        try {
            const list = await this.friendListModel.findOne({ userId });
            const friend = list && list.friends && list.friends.find(friend => friend.userId === targetUserId);
            console.log(list, targetUserId);
            if(friend) {
                return friend;
            } else {
                return null;
            }
        } catch(err) {
            throw new Error(err.message);
        }
    }

    async updateFriendInfo(userId: number, targetUserId: number, newInfo: object) {
        try {
            targetUserId = Number(targetUserId);
            userId = Number(userId);
        } catch(err) {
            throw new Error(err.message);
        }

        try {
            const list = await this.friendListModel.findOne({ userId });
            const index = list && list.friends && list.friends.findIndex(friend => friend.userId === targetUserId);
            console.log(list, targetUserId, newInfo);
            console.log(index);
            if(index > -1) {
                list.friends[index] = Object.assign(list.friends[index], newInfo);
                console.log(list);
                await list.save();
                return {
                    status: 1,
                }
            } else {
                throw new Error('不是你的好友');
            }
        } catch(err) {
            throw new Error(err.message);
        }
    }

    private _getIsFriendKey(userId: number, targetUserId: number) {
        return this.redisHelper.WithRedisNameSpace(`IsFriend:${userId < targetUserId ? `${userId}_${targetUserId}` : `${targetUserId}_${userId}`}`);
    }
}