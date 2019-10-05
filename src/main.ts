import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NormalHttpExceptionFilter } from './middleware/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
  );
  /*
  app.useGlobalFilters(
    new NormalHttpExceptionFilter()
  );
  */
  await app.listen(3000);
}
bootstrap();
