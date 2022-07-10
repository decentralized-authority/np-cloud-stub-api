class Invitation {

  /**
   * @type {string}
   */
  invitation = '';

  /**
   * @type {string}
   */
  memo = '';

  /**
   * @type {boolean}
   */
  valid = false;

  /**
   * @type {string}
   */
  redeemedByUser = '';

  /**
   * @param {Invitation} data
   */
  constructor(data) {
    Object.assign(this, data);
  }

}

module.exports.Invitation = Invitation;
