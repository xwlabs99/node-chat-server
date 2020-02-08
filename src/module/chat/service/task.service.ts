import { Injectable, Inject } from '@nestjs/common';
import { RedisHelper } from '../helper/redisHelper.provider';
import { Redis } from '../../../provider/redis.provider';
import { Message, Group } from '../interface/model.interface';
import { Repository } from 'typeorm';
import { Task } from '../model/mysql/task.entity';
import { AuthService, AUTH_TYPE } from './authority.service';
import { GroupService } from './group.service';
import { ChatService } from '../chat.service';
const moment = require('moment');

@Injectable()
export class TaskService {
    constructor(
        private readonly helper: RedisHelper,
        private readonly redis: Redis,
        private readonly authService: AuthService,
        private readonly groupSevice: GroupService,
        @Inject('TASK_REPOSITORY')
        private readonly taskRepository: Repository<Task>,
        private readonly chatService: ChatService,
    ){}
    static REDIS_TASK_FIELD = 'task';

    WrapGroupTaskListKey(groupId: string) {
        return this.helper.WithRedisNameSpace(`${TaskService.REDIS_TASK_FIELD}:glist:${groupId}`);
    }

    WrapUserTaskListKey(userId: number) {
        return this.helper.WithRedisNameSpace(`${TaskService.REDIS_TASK_FIELD}:ulist:${userId}`);
    }

    WrapTaskInfoKey(taskId: number) {
        return this.helper.WithRedisNameSpace(`${TaskService.REDIS_TASK_FIELD}:info:${taskId}`);
    }

    async createTask(operatorId: number, groupId: string, taskInfo: Task): Promise<Task> {
        const hasAuth = await this.authService.hasAuthorityInGroup(groupId, operatorId, AUTH_TYPE.MANAGE_TASK);
        if(hasAuth !== 1) {
            throw new Error('你没有管理通知的权限');
        }
        const processRecord = JSON.stringify([
            { date: new Date().getTime(), operatorId, infoChange: taskInfo },
        ]);
        return await this.taskRepository.save({ ...taskInfo, processRecord, createdDate: moment().format('YYYY-MM-DD') });
    }

    async addToGroupTaskList(groupId: string, taskId: number): Promise<Group> {
        const group = await this.groupSevice.getGroupInfoById(groupId);
        if(group.tasks.includes(taskId)) {
            throw new Error('通知列表ID重复');
        }
        group.tasks.push(taskId);
        const result = await group.save();
        this.redis.SADD(this.WrapGroupTaskListKey(groupId), result.tasks);
        return result;
    }

    async updateOneTaskById(operatorId: number, taskId: number, newInfo: Task): Promise<Task[]> {
        const oldTaskInfo = await this.taskRepository.findOne({ id: taskId });
        if(!oldTaskInfo) {
            throw new Error('没有对应的消息记录');
        }
        const hasAuth = await this.authService.hasAuthorityInGroup(oldTaskInfo.groupId, operatorId, AUTH_TYPE.MANAGE_TASK);
        if(hasAuth !== 1) {
            throw new Error('你没有管理通知的权限');
        }
        const { processRecord: oldProcessRecord } = oldTaskInfo;
        const newProcessRecord: object[] = JSON.parse(oldProcessRecord);
        newProcessRecord.push({
            date: new Date().getTime(), operatorId, infoChange: newInfo,
        });
        const result = await this.taskRepository.update(taskId, { processRecord: JSON.stringify(newProcessRecord), ...newInfo });
        if(result) {
            this.redis.DEL(this.WrapTaskInfoKey(taskId));
            // this.redis.HMSET(this.WrapTaskInfoKey(taskId), newInfo);
            return [ oldTaskInfo, newInfo ];
        }
        throw new Error('更新信息时出现错误');
    }

    async getHistoryList(groupId: string, date: string) {
        return await this.taskRepository.find({
            createdDate: date,
            groupId,
        });
    }

    async getGroupTaskListById(groupId: string): Promise<Task[]> {
        const groupListKey = this.WrapGroupTaskListKey(groupId);
        let taskIds: any[];
        if(await this.redis.EXISTS(groupListKey)) {
            taskIds = await this.redis.SMEMBER(groupListKey);
        } else {
            const { tasks } = await this.groupSevice.getGroupInfoById(groupId);
            taskIds = tasks;
            this.redis.SADD(groupListKey, taskIds);
        }
       
        const taskInfos: any = await Promise.all(taskIds.map(async taskId => {
            let _taskId = Number(taskId);
            const taskInfoKey = this.WrapTaskInfoKey(_taskId);
            if(await this.redis.EXISTS(taskInfoKey)) {
                return await this.redis.HGETALL(taskInfoKey);
            } else {
                const taskInfo: Task = await this.taskRepository.findOne(_taskId);
                if(taskInfo) {
                    delete taskInfo.processRecord;
                    this.redis.HMSET(taskInfoKey, taskInfo);
                    return taskInfo;
                } else {
                    return { id: taskId };
                }
            }
        }));
        return taskInfos;
    }

    async removeTaskFromGList(operatorId: number, groupId: string, _taskId: number): Promise<Group> {
        let taskId = Number(_taskId);
        const hasAuth = await this.authService.hasAuthorityInGroup(groupId, operatorId, AUTH_TYPE.MANAGE_TASK);
        if(hasAuth !== 1) {
            throw new Error('你没有管理通知的权限');
        }
        const group = await this.groupSevice.getGroupInfoById(groupId);
        const taskList = group.tasks;
        if(taskList.includes(taskId)) {
            const groupListKey = this.WrapGroupTaskListKey(groupId);
            let oldLength = group.tasks.length;
            group.tasks = group.tasks.filter(tid => tid !== taskId);
            if(group.tasks.length === oldLength) {
                throw new Error('删除失败，列表中无此id');
            }
            if(await this.redis.EXISTS(groupListKey)) {
                this.redis.SREMOVE(groupListKey, [ String(taskId) ]);
            } else {
                this.redis.SADD(groupListKey, group.tasks);
            }
            this.redis.DEL(this.WrapTaskInfoKey(taskId));
            this.taskRepository.update(taskId, { status: 0 });
            return group.save();
        } else {
            throw new Error('该公告不存在于数据库中');
        }
    }

    async sendNoticeToGroupMember(groupInfo: Group, description: string, taskPayload: object) {
        const systemNotice = {
            type: 'task',
            groupName: groupInfo.groupName,
            groupId: groupInfo.groupId,
            time: new Date().getTime(),
            ...taskPayload
        };
        groupInfo.members.forEach(member => {
            this.chatService.sendSystemMessageToOne('taskHelper', member.userId, '公告助手', `[${groupInfo.groupName}]` + description, systemNotice);
        })
    
    }
}   