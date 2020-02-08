import { Connection, Repository } from 'typeorm';
import { Task } from './task.entity';

export const TaskMysqlProviders = [
  {
    provide: 'TASK_REPOSITORY',
    useFactory: (connection: Connection) => connection.getRepository(Task),
    inject: ['MYSQL_CONNECTION'],
  },
];