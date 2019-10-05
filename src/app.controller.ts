import { Controller, Get } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
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
