//用户信息，用户设置等等,
import * as mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
    name: { 
        type: String,
        required: true,
    },
    userId: {
        type: Number,
        index: true,
        unique: true,
        required: true,
    },
    type: {
        type: String,
        default: 'normal',
    },
    avatar: String,
    // socketId: String,
    // systemPushId: String,
    // systemPushType: String,
    // normalPushId: String,
    // normalPushType: String,
});


export const Friend = new mongoose.Schema({
    userId: {
        type: Number,
        required: true,
        unique: true,
        sparse: true,
    },
    alias: String,
});

export const UserGroupItem = new mongoose.Schema({
    groupId: {
        type: String,
        required: true,
    },
    tips: String,
})

export const UserFriendList = new mongoose.Schema({
    userId: {
        type: Number,
        index: true,
        unique: true,
        sparse: true,
    },
    friends: [Friend],
});

export const UserGroupList = new mongoose.Schema({
    userId: {
        type: Number,
        index: true,
        unique: true,
        sparse: true,
    },
    groups: [UserGroupItem],
});