import { Injectable } from '@nestjs/common';
import { promisify } from 'util';
const redis = require('redis');
const WrapPromise = (func) => promisify(func).bind(Redis.instance)
@Injectable()
export class Redis {
    public static instance = null;
    constructor() {
        console.log('创建redis实例');
        Redis.instance = redis.createClient();
        return this;
    }

    /**
     * @description 成功返回true，不成功返回false
     */
    async SET(key: string, value: string | number, expire?: number): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.set)(key, value, expire ? 'EX' : undefined, expire);
        console.log(res);
        if(res === 'OK') {
            return true;
        } else {
            return false;
        }
    }

    async GET(key: string): Promise<string> {
        return await WrapPromise(Redis.instance.get)(key);
    }
    /**
     * @description key存在时删除key，成功返回true，否则返回false
     */
    async DEL(key: string): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.del)(key);
        return res === 1;
    }
    /**
     * @description 检查是否存在键,存在返回true，不存在返回false
     */
    async EXISTS(key: string): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.exists)(key);
        return res === 1;
    }

    /**
     * @description 存储哈希
     * @param key 哈希键名
     * @param hash 对象
     */
    async HMSET(key: string, hash: object = {}, expire?: number) {
        const res = await WrapPromise(Redis.instance.hmset)(key, hash);
        return res === 'OK';
    }

    /**
     * @description 获取哈希
     * @param key 哈希键名
     * @returns 返回哈希对象
     */
    async HMGET(key: string, fields: string[] = []): Promise<object> {
        let res;
        if(fields.length === 0) {
            res = await WrapPromise(Redis.instance.hgetall)(key);
            if(Array.isArray(res) && res[0] === null) {
                return {};
            }
            return res;
        } else {
            let obj = {};
            res = await WrapPromise(Redis.instance.hmget)(key, ...fields);
            fields.forEach((i,index) => obj[i] = res[index]);
            return obj;
        }
    }

    async HGET(key: string, field: string): Promise<object> {
        const res = await WrapPromise(Redis.instance.hget)(key, field);
        return res;
    }

    async HGETALL(key: string): Promise<object> {
        const res = await WrapPromise(Redis.instance.hgetall)(key);
        return res;
    }

    /**
     * @description 删除哈希字段，不存在的将会被忽略
     * @param key 哈希键名
     * @param fields 字段数组
     * @returns 返回被成功删除的字段数量
     */
    async HDEL(key: string, fields: string[]): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.hdel)(key, ...fields);
        return res;
    }
    
    /**
     * @description 向集合中添加元素
     * @param key 键名
     * @returns 返回集合新增成员数
     */
    async SADD(key: string, values: string[] = []): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.sadd)(key, ...values);
        console.log(res);
        return res;
    }
    /**
     * @description 
     * @param key 集合键名
     * @returns 返回所有成员
     */

    async SMEMBER(key: string): Promise<string[]> {
        const res = await WrapPromise(Redis.instance.smembers)(key);
        return res;
    }

    async SISMEMBER(key: string, member: string): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.sismember)(key, member);
        return res;
    }

    async SREMOVE(key: string, members: string[] = []): Promise<boolean> {
        const res = await WrapPromise(Redis.instance.srem)(key, ...members);
        return res === 1;
    }
    
    async HKEYS(key: string):Promise<string[]> {
        return await WrapPromise(Redis.instance.hkeys)(key);
    }

}
