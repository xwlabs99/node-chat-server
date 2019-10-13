import { Controller, Get } from '@nestjs/common';
@Controller()
export class AppController {
  constructor(
  ){}

  @Get()
  getHello(): string {
    // this.socketGateway.sendMsg();
    return "ok";
  }
}
