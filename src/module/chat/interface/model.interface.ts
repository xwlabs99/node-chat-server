import { Document } from 'mongoose';

export interface Message extends Document{
    messageId: string,
    messageType: string,
    content: string,
    time: number,
    groupId: string,
    userId: number,
    renderTime: boolean,
}

export interface UserMsgList extends Document {
    userId: number,
    list: Array<Message>,
}

export interface User extends Document {
    name: string,
    userId: number,
    avatar: string,
    socketId: string,
    systemPushId: string,
    systemPushType: string,
    normalPushId: string,
    normalPushType: string,
    groups: Array<string>
}

export interface GroupMember extends Document {
    userId: number,
    alias: string,
    ignoreAllMsg: boolean,
    ignoreAutoMsg: boolean,
    isAdmin: boolean,
}


export interface Group extends Document {
    groupName: string,
    groupId: string,
    groupType: string,
    announcement: string,
    members: Array<GroupMember>,
    createrId: number,
}

export interface Friend extends Document  {
    userId: number,
    alias: string,
}

export interface UserGroupItem extends Document {
    groupId: string,
    tips: string,
}

export interface UserFriendList extends Document {
    userId: number,
    friends: Array<Friend>,
}

export interface UserGroupList extends Document {
    userId: number,
    groups: Array<UserGroupItem>,
}