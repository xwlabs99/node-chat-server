import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
const JWT = require('jsonwebtoken');
const JWT_KEY = 'test_weixiang';

@Injectable()
export class AuthorizationMiddleware implements NestMiddleware {
  constructor(
  ){}
  async use(req: Request, res: Response, next: Function) {
    const token = req.headers.authorization;
    const userInfo = await this._JWTverify(token);
    if(userInfo) {
      req.body.authorization = userInfo || {};
      next();
    } else {
      throw new HttpException({
        status: 0,
        message: '缺少认证信息',
      }, HttpStatus.UNAUTHORIZED);
    }

  }

  private _JWTverify(jwt) {
    return new Promise((resolve, reject) => {
        JWT.verify(jwt, JWT_KEY, async (err, decode) => {
            if (err) {
                resolve(null);
            } else {
                resolve(decode);
            }
        });
    });
}
}
