import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
  } from '@nestjs/websockets';
import { Client, Server, Socket } from 'socket.io';
import { Injectable, Inject, forwardRef, HttpService } from '@nestjs/common';

@Injectable()
@WebSocketGateway()
export class SocketGateway {
    socketId;
    @WebSocketServer()
    server: Server;
    constructor(
    ){}

    getClient(socketId): Socket {
        return this.server.sockets.sockets[socketId];
    }

    async checkIsOnline(): Promise<Socket>{
        return this.getClient(this.socketId);
    }
    // 客户端连接
    @SubscribeMessage('connected')
    async onConnect(client: Client, data) {
        const socketId = client.id;
        this.socketId = socketId;
        console.log('connected:' , socketId, data);
    }

    @SubscribeMessage('disconnected')
    async onDisconnect(client: Client) {
        const socketId = client.id;
        console.log('disconnected:' , socketId);
    }

    async sendMsg() {
        const client = await this.checkIsOnline();
        if(client) {
            client.emit('newMessage', {
                title: "123",
                content: "hello"
            });
            return undefined;
        } else {
            console.log('没有连接的客户端');
        }
    }

}
