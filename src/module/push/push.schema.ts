//三个集合 group信息本身：名称类型群成员, 用户的groupList,groupList以gid,推送设置为
//用户信息，用户设置等等,
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';

export interface PushUser extends Document{
    pushId: string,
    socketId: string,
    extraPushType: string,
    extraPushToken: string,
}

export const PushUserSchema = new mongoose.Schema({
    socketId: { type: String, default: '' },
    extraPushType: { type: String, default: '' },
    extraPushToken: { type: String, default: '' },
});
