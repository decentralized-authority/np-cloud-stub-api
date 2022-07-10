class User {

  /**
   * @type {string}
   */
  id = '';

  /**
   * @type {string}
   */
  address = '';

  /**
   * @type {string}
   */
  password = '';

  /**
   * @param {User} data
   */
  constructor(data) {
    this.address = data.address;
    this.id = data.id;
    this.password = data.password;
  }

}

module.exports.User = User;
