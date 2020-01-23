//三个集合 group信息本身：名称类型群成员, 用户的groupList,groupList以gid,推送设置为
//用户信息，用户设置等等,
import * as mongoose from 'mongoose';


export const GroupMember = new mongoose.Schema({
    userId: { type: Number, required: true },
    alias: { type: String, required: true },
    ignoreAllMsg: { type: Boolean, default: false },
    ignoreAutoMsg: { type: Boolean, default: false },
    authority: { type: String, default: '11111111111111111' },
});

export const Group = new mongoose.Schema({
    groupName: String,
    announcement: String,
    groupId: {
        type: String,
        required: true,
        index: true,
        unique: true,
    },
    groupType: {
        type: String,
        required: true,
    },
    members: [GroupMember],
    createrId: Number,
    avatar: String,
});

