import { Injectable } from '@nestjs/common';
const JWT = require('jsonwebtoken');
const JWT_KEY = 'test_weixiang';


@Injectable()
export class AuthHelper {
    JWTverify(jwt) {
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