const dayjs = require('dayjs');
const { generateId } = require('../util');

class SessionToken {

  /**
   * @type {string}
   */
  user = '';

  /**
   * @type {string}
   */
  token = generateId();

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
