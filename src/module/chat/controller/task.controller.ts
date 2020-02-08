import { Injectable, Controller, Get, Post, Put, Delete, Body, Param, UseInterceptors, Req, Query } from '@nestjs/common';
import { TaskService } from '../service/task.service';
import { Task } from '../model/mysql/task.entity';
import { FileInterceptor } from '@nestjs/platform-express';
const fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);
import { join } from 'path';


@Controller('chat/task')
export class TaskController {
    constructor(
        private readonly taskService: TaskService,
    ){}


    @Post('upload')
    @UseInterceptors(FileInterceptor('file',{ dest: join('..', 'static/task') }))
    async uploadFile(@Req() req, @Query() query) {
        const { originalname, path } = req.file;
        console.log(req.file);
        const err = await rename(join(path), join('..', 'static/task', originalname));
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


    @Post('group/:id')
    async addTaskToGList(@Param('id') groupId, @Body('data') newTaskInfo: Task, @Body('authorization') auth) {
        try {
            const { id: operatorId } = auth;
            console.log(newTaskInfo);
            if(!groupId || !newTaskInfo) {
                throw new Error('缺少参数');
            }
            const taskInfo = await this.taskService.createTask(operatorId, groupId, newTaskInfo);
            const groupInfo = await this.taskService.addToGroupTaskList(groupId, taskInfo.id);
            this.taskService.sendNoticeToGroupMember(groupInfo, taskInfo.description, {
                taskId: taskInfo.id,
                taskType: taskInfo.type,
                createrName: groupInfo.members.find(m => m.userId === operatorId).alias,
                description:  taskInfo.description,
            });
            return {
                status: 1,
                data: taskInfo,
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message || '更新信息出现错误',
            }
        }
    }

    @Get('group/:id')
    async getTaskGroupList(@Param('id') groupId, @Body('authorization') auth) {
        try {
            const groupTaskList = await this.taskService.getGroupTaskListById(groupId);
            console.log(groupTaskList);
            return {
                status: 1,
                data: groupTaskList
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message || '获取列表出错',
            }
        }
    }

    @Get('history/:id')
    async getHistoryList(@Param('id') groupId, @Body('authorization') auth, @Query('date') date) {
        try {
            const groupTaskList = await this.taskService.getHistoryList(groupId, date);
            console.log(groupTaskList);
            return {
                status: 1,
                data: groupTaskList
            }
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message || '获取列表出错',
            }
        }
    }


    @Put('info/:id')
    async updateTaskInfo(@Param('id') taskId, @Body('data') infoChange, @Body('authorization') auth) {
        try {
            const { id: operatorId } = auth;
            console.log(infoChange);
            const updatedInfo = await this.taskService.updateOneTaskById(operatorId, taskId, infoChange);
            
            return {
                status: 1,
                data: updatedInfo
            };
        } catch(err) {
            return {
                status: 0,
                message: err.message || '更新信息出现错误',
            }
        }
    }

    @Delete('group/:id')
    async removeTaskFromGList(@Param('id') groupId, @Body('data') body, @Body('authorization') auth) {
        try {
            const { id: operatorId } = auth;
            const { taskId } = body;
            const result = await this.taskService.removeTaskFromGList(operatorId, groupId, taskId);
            return {
                status: 1,
                data: result
            }
        } catch(err) {
            return {
                status: 0,
                message: err.message || '更新信息出现错误',
            }
        }
    }


    @Get('user/:id')
    async getTaskUserList(@Param('id') groupId, @Body('authorization') auth) {
        try {
            
        } catch(err) {
            console.log(err);
            return {
                status: 0,
                message: err.message,
            }
        }
    }

    @Post('user/:id')
    async addTaskToUList(@Param('id') taskId, @Body('data') infoChange, @Body('authorization') auth) {
        try {
        
        } catch(err) {
            return {
                status: 0,
                message: err.message || '更新信息出现错误',
            }
        }
    }

    @Delete('user/:id')
    async removeTaskFromUList(@Param('id') taskId, @Body('data') infoChange, @Body('authorization') auth) {
        try {
        
        } catch(err) {
            return {
                status: 0,
                message: err.message || '更新信息出现错误',
            }
        }
    }

    
}
