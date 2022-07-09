const uuid = require('uuid');
const dayjs = require('dayjs');

class SessionToken {

  /**
   * @type {string}
   */
  user = '';

  /**
   * @type {string}
   */
  token = uuid.v4().replace(/-/g, '');

  /**
   * @type {string}
   */
  expiration = '';

  /**
   * @param {SessionToken} data
   */
  constructor(data) {
    this.user = data.user;
    this.token = data.token || this.token;
    this.expiration = data.expiration || dayjs().add(1, 'day').toISOString();
  }

}

module.exports.SessionToken = SessionToken;
