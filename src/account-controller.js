const _ = require('lodash');
const { Account, CoinDenom, Pocket } = require('@pokt-network/pocket-js');
const {TRANSACTION_FEE_UPOKT} = require('./constants');
const { generateId } = require('./util');
const math = require('mathjs');

const { bignumber } = math;

class AccountController {

  static generatePassword() {
    return [generateId(), generateId()].join('');
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
    return math.divide(bignumber(balance.toString()), bignumber('1000000')).toString();
  }

  /**
   * @param {string} privateKey
   * @param {string} amount
   * @param {string} fromAddress
   * @param {string} toAddress
   * @returns {Promise<string>}
   */
  async send(privateKey, amount, fromAddress, toAddress) {
    const transactionSender = await this._pocket.withPrivateKey(privateKey);
    if(_.isError(transactionSender))
      throw transactionSender;
    const rawTxResponse = await transactionSender
      .send(fromAddress, toAddress, math.multiply(bignumber(amount), bignumber('1000000')).toString())
      .submit('testnet', TRANSACTION_FEE_UPOKT, CoinDenom.Upokt);
    if(_.isError(rawTxResponse))
      throw rawTxResponse;
    return rawTxResponse.hash;
  }

  async getTransaction(hash) {
    const res = await this._pocket.rpc().query.getTX(hash);
    if(_.isError(res))
      throw res;
    else
      return res.transaction;
  }

}

module.exports.AccountController = AccountController;
