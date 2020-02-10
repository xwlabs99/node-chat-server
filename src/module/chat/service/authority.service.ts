import { Injectable, Inject, forwardRef, UseFilters } from '@nestjs/common';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { Message, Group } from '../interface/model.interface';
import { GroupService } from './group.service';
import { UserService } from './user.service';




export const AUTH_TYPE = {
    MANAGE_AUTH: "MANAGE_AUTH",
    SEND_MSG: "SEND_MSG",
    CHANGE_GROUPINFO: "CHANGE_GROUPINFO",
    INVITE_USER: "INVITE_USER",
    REMOVE_USER: "REMOVE_USER",
    CREATE_ORDER: "CREATE_ORDER",
    EDIT_ORDER: "EDIT_ORDER",
    SEE_ALL_ORDER: "SEE_ALL_ORDER",
    CHANGE_PACKAGE: "CHANGE_PACKAGE",
    CHECK_TICKET: "CHECK_TICKET",
    MANAGE_TASK: "MANAGE_TASK"
}

export const DEFAULT_GROUP_CREATER_AUTH = (function(){
    const obj = {};
    Object.keys(AUTH_TYPE).forEach(auth => obj[auth] = 1);
    return obj;
})();

export interface Auth {
    MANAGE_AUTH?: number,
    SEND_MSG?: number,
    CHANGE_GROUPINFO?: number,
    INVITE_USER?: number,
    REMOVE_USER?: number,
    CREATE_ORDER?: number,
    EDIT_ORDER?: number,
    SEE_ALL_ORDER?: number,
    CHANGE_PACKAGE?: number,
    CHECK_TICKET?: number,
    MANAGE_TASK?: number,
}

const AUTH_TYPE_INFO = {
    MANAGE_AUTH: {
        pos: 0,
        des: '管理权限',
    },
    SEND_MSG: {
        pos: 1,
        des: '发送消息',
    },
    CHANGE_GROUPINFO: {
        pos: 2,
        des: '修改群信息',
    },
    INVITE_USER: {
        pos: 3,
        des: '邀请群成员',
    },
    REMOVE_USER: {
        pos: 4,
        des: '踢出群成员',
    },
    CREATE_ORDER: {
        pos: 5,
        des: '创建订单',
    },
    EDIT_ORDER: {
        pos: 6,
        des: '编辑订单',
    },
    SEE_ALL_ORDER: {
        pos: 7,
        des: '查看所有订单',
    },
    CHANGE_PACKAGE: {
        pos: 8,
        des: '管理套餐',
    },
    CHECK_TICKET: {
        pos: 9,
        des: '验证券码',
    },
    MANAGE_TASK: {
        pos: 10,
        des: '管理通知',
    }
}

@Injectable()
export class AuthService {
    constructor(
        private readonly helper: RedisHelper,
        private readonly redis: Redis,
        @Inject(forwardRef(() => GroupService))
        private readonly groupService: GroupService,
        private readonly userService: UserService
    ){}
    static REDIS_AUTH_FIELD = 'auth';

    getDefaultAuthStr(extraAuth?: Auth) {
        let defaultAuth = {
            MANAGE_AUTH: 0,
            SEND_MSG: 1,
            CHANGE_GROUPINFO: 0,
            INVITE_USER: 1,
            REMOVE_USER: 0,
            CREATE_ORDER: 0,
            EDIT_ORDER: 0,
            SEE_ALL_ORDER: 1,
            CHANGE_PACKAGE: 0,
            CHECK_TICKET: 0,
            MANAGE_TASK: 0,
        };
        if(extraAuth) {
            defaultAuth = Object.assign(defaultAuth, extraAuth);
        }
        return this.makeAuthStr(defaultAuth);
    }

    WrapInfoKey(groupId:string, userId: number) {
        return this.helper.WithRedisNameSpace(`${AuthService.REDIS_AUTH_FIELD}:${groupId}:${userId}`);
    }

    makeAuthStr(authObj: Auth, srcAuthStr?:string) {
        let str = srcAuthStr || '000000000000000000000000';
        Object.keys(authObj).forEach(auth => {
            str = replacePos(str, AUTH_TYPE_INFO[auth].pos, authObj[auth]);
        });
        return str;
    }

    async getGroupAuth(operatorId: number, groupId: string) {
        const groupInfo  = await this.groupService.getOneGroupAllMemberInfo(groupId, true);
        const queryUserInfo = groupInfo.members.find(m => m.userId === Number(operatorId));
        if((queryUserInfo && queryUserInfo.authority[0] === '1') || Number(operatorId) === groupInfo.createrId) {
            const userInfos = await this.userService.getMuiltUserBaseInfo(groupInfo.members.map(m => m.userId));
            return [ groupInfo, userInfos ];
        }
        throw new Error('你没有权限查询');
    }

    async cacheGroupAuth(groupInfo?: Group) {
        const { groupId } = groupInfo;
        groupInfo.members.forEach(member => {
            const cacheKey = this.WrapInfoKey(groupId, member.userId);
            this.redis.SET(cacheKey, member.authority, 300);
        });
    }

    async updateUserAuthorityInGroup(operatorId: number, groupId: string, userAuthObj: object) {
        const groupInfo  = await this.groupService.getOneGroupAllMemberInfo(groupId);
        const operatorInfo = groupInfo.members.find(m => m.userId === Number(operatorId));
        if(!operatorInfo || (operatorInfo && operatorInfo.authority[AUTH_TYPE_INFO.MANAGE_AUTH.pos] === '0')) {
            throw new Error('你没有权限进行此操作');
        }

        groupInfo.members.forEach(member => {
            if(!member.authority) {
                throw new Error('请创建新群以支持权限管理');
            }
            if(userAuthObj[member.userId]) {
                if(operatorId !== groupInfo.createrId && member.authority[AUTH_TYPE_INFO.MANAGE_AUTH.pos] === '1') {
                    throw new Error('你没有权限修改其他管理员权限');
                }
                member.authority = this.makeAuthStr(userAuthObj[member.userId], member.authority);
            }
        });
        
        this.cacheGroupAuth(groupInfo);
        return await groupInfo.save();
    }

    async hasAuthorityInGroup(groupId: string, userId: number, authType: string): Promise<number> {
        const cacheKey = this.WrapInfoKey(groupId, userId);
        console.log(groupId, userId, authType);
        if(await this.redis.EXISTS(cacheKey)) {
            const value = await this.redis.GET(cacheKey);
            console.log('已经缓存', value, AUTH_TYPE_INFO[authType].pos);
            this.redis.SET(cacheKey, value, 300);
            return Number(value[AUTH_TYPE_INFO[authType].pos]);
        } else {
            const groupInfo: Group = await this.groupService.getOneGroupAllMemberInfo(groupId);
            const { members } = groupInfo;
            let ans = null;
            members.forEach(member => {
                if(!member.authority) {
                    throw new Error('该群不支持权限管理');
                }
                if(Number(member.userId) === Number(userId)) {
                    ans = member.authority;
                }
                this.redis.SET(this.WrapInfoKey(groupId, member.userId), member.authority, 300);
            });
            console.log('没有缓存', ans, AUTH_TYPE_INFO[authType].pos);
            return ans ? Number(ans[AUTH_TYPE_INFO[authType].pos]) : 0;
        }
    }

}


function replacePos(strObj, pos, replacetext) {
    if(pos !== 0 && !pos) {
        throw new Error('出现错误');
    }
    let str;
    if(pos === 0) {
        str = replacetext + strObj.substring(1);
    } else if(pos === strObj.length - 1){
        str = strObj.substr(0, strObj.length - 1) + replacetext;
    } else {
        str = strObj.substring(0, pos) + replacetext + strObj.substring(pos + 1);
    }
    return str;
}