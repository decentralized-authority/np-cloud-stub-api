const _ = require('lodash');
const { Account, Pocket } = require('@pokt-network/pocket-js');
const uuid = require('uuid');

class AccountController {

  static generatePassword() {
    return [uuid.v4(), uuid.v4()]
      .join('')
      .replace(/-/g, '');
  }

  /**
   * @type {Pocket|null}
   * @private
   */
  _pocket = null;

  /**
   * @param {Pocket} pocket
   */
  constructor(pocket) {
    this._pocket = pocket;
  }

  /**
   * @param {string} password
   * @returns {Promise<{address: string, encryptedPrivateKey: string, password: string, publicKey: string, rawPrivateKey: string}>}
   */
  async create(password) {
    const account = await this._pocket.keybase.createAccount(password);
    if(_.isError(account))
      throw(account);
    const ppk = await this._pocket.keybase.exportPPKfromAccount(account.addressHex, password, '', password);
    const unlockedAccount = await this._pocket.keybase.getUnlockedAccount(account.addressHex, password);
    if(_.isError(unlockedAccount))
      throw unlockedAccount;
    return {
      address: account.addressHex,
      encryptedPrivateKey: ppk,
      password,
      publicKey: account.publicKey.toString('hex'),
      rawPrivateKey: unlockedAccount.privateKey.toString('hex'),
    };
  }

  /**
   * @param {Promise<string>} address
   */
  async getBalance(address) {
    const res = await this._pocket.rpc().query.getBalance(address);
    if(_.isError(res))
      throw res;
    const { balance } = res;
    return (balance / BigInt(1000000)).toString(10);
  }

}

module.exports.AccountController = AccountController;
