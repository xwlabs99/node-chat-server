import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NormalHttpExceptionFilter } from './middleware/http-exception.filter';
import * as serveStatic from 'serve-static';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
  );
  app.use('/static', serveStatic(join(__dirname, '../../static'), {
    maxAge: '1d',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'aac'],
   }));
  /*
  app.useGlobalFilters(
    new NormalHttpExceptionFilter()
  );
  */
  await app.listen(3000);
}
bootstrap();
