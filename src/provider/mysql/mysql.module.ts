import { Module } from '@nestjs/common';
import { databaseProviders } from './mysql.provider';

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class MysqlModule {}