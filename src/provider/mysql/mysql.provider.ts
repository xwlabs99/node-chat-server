import { createConnection } from 'typeorm';

export const databaseProviders = [
  {
    provide: 'MYSQL_CONNECTION',
    useFactory: async () => await createConnection({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'Weixiang1999',
      database: 'chat_server',
      entities: [
          __dirname + '/*.entity{.ts,.js}',
      ],
      synchronize: true,
      extra: {
        
      }
    }),
  },
];