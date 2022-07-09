class ValidatorNode {

  /**
   * @type {string}
   */
  address = '';

  /**
   * @type {string}
   */
  balance = '0';

  /**
   * @type {boolean}
   */
  jailed = false;

  /**
   * @type {string}
   */
  publicKey = '';

  /**
   * @type {string}
   */
  region = '';

  /**
   * @type {string}
   */
  reportBlock = '';

  /**
   * @type {boolean}
   */
  staked = false;

  /**
   * @type {string}
   */
  stakedAmount = '0';

  /**
   * @type {number}
   */
  stakedBlock = 0;

  /**
   * @type {string}
   */
  timestamp = '';

  /**
   * @type {string}
   */
  unstakeDate = '';

  /**
   * @type {string}
   */
  url = '';

  /**
   * @type {string}
   */
  user = '';

  /**
   * @type {string}
   */
  balanceRequired = '';

  /**
   * @type {string}
   */
  password = '';

  /**
   * @type {string} stakeTx
   */
  stakeTx = '';

  /**
   * @param {ValidatorNode} data
   */
  constructor(data = {}) {
    Object.assign(this, data);
  }

}

module.exports.ValidatorNode = ValidatorNode;
