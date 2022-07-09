class User {

  /**
   * @type {string}
   */
  id = '';

  /**
   * @type {string}
   */
  password = '';

  /**
   * @param {User} data
   */
  constructor(data) {
    this.id = data.id;
    this.password = data.password;
  }

}

module.exports.User = User;
