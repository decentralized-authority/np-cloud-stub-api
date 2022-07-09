class Node {

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
   * @param {Node} data
   */
  constructor(data = {}) {
    Object.assign(this, data);
  }

}

module.exports.Node = Node;
