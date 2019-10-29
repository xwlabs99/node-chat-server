const apn = require('apn');
const _ = require('lodash');

export default class IOS {
  options;
  constructor(options: any = {}) {
    options.maxLength = options.maxLength || 100;
    this.options = options;
    if (!options.cert) throw new Error('IOS Cert 不能为空');
    if (!options.key) throw new Error('IOS Key 不能为空');
    if (!options.topic) throw new Error('IOS Topic 不能为空');
  }


  async sleep(time) {
    return new Promise((reslove) => {
      setTimeout(() => {
        reslove({});
      }, time);
    })
  }

  async push(data) {
    let n = 0;
    let success_total = 0;
    let fail_total = 0;

    const pushIds = _.chunk(data.list, this.options.maxLength);
    for (const i in pushIds) {
      let provider;
      try {
        provider = new apn.Provider(this.options);
      } catch (e) {
        throw new Error('证书过期');
      }

      data.list = pushIds[i];
      const compiled = _.merge({
        aps: {
          alert: {
            title: data.title,
            body: data.content,
          },
          badge: 1,
          // 'mutable-content': 1,
          sound: 'default'
        }
      }, data);

      const opt = {
        topic: this.options.topic,
        expiry: Math.floor(Date.now() / 1000) + 86400,
        compiled: JSON.stringify(compiled)
      };

      data.success = data.success || function () { };
      data.fail = data.fail || function () { };
      data.finish = data.finish || function () { };

      const notification = new apn.Notification(opt);
      data.sleep && await this.sleep(data.sleep);
      provider.send(notification, data.list).then(res => {
        if (res.sent && res.sent.length) {
          success_total += res.sent.length;
          data.success(res);
        }
        
        if (res.failed && res.failed.length) {
          fail_total += res.failed.length;
          data.fail(res)
        }
        n++;
        if (n >= pushIds.length) {
          data.finish({
            status: 'success',
            maxLength: this.options.maxLength,
            group: pushIds.length,
            success_total,
            fail_total
          });
        }
      }).catch((err) => {
        console.log(err);
      });

      provider.shutdown();

    }
  }
}
