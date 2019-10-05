import { Controller, Get } from '@nestjs/common';

@Controller()
export class PushController {
  constructor(
    private readonly socketGateway: SocketGateway,
  ){}

  @Get()
  getHello(): string {
    this.socketGateway.sendMsg();
    return "ok";
  }
}
