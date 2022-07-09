const { dataStoreKeys } = require('./constants');
const { EventEmitter } = require('events');
const { Pocket } = require('@pokt-network/pocket-js');
const _ = require('lodash');

class BlockController extends EventEmitter {

  static events = {
    BLOCK_INCREASE: 'BLOCK_INCREASE',
  };

  /**
   * @type {number}
   * @private
   */
  _interval = 10000;

  /**
   * @type {number}
   * @private
   */
  _block = 0;

  /**
   * @type {Pocket|null}
   * @private
   */
  _pocket = null;

  /**
   * @type {(err: any) => void}
   * @private
   */
  _handleError = console.error;

  /**
   * @param {Pocket} pocket
   * @param {(err: any) => void} handleError
   */
  constructor(pocket, handleError) {
    super();
    this._pocket = pocket;
    this._handleError = handleError || this._handleError;
  }

  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    await this._checkBlockHeight();
    setInterval(() => {
      this._checkBlockHeight()
        .catch(this._handleError);
    }, this._interval);
  }

  async _checkBlockHeight() {
    try {
      const res = await this._pocket.rpc().query.getHeight();
      if(_.isError(res)) {
        throw res;
      } else {
        const height = Number(res.height);
        if(height > this._block) {
          this._block = height;
          this.emit(BlockController.events.BLOCK_INCREASE, height);
        }
      }
    } catch(err) {
      this._handleError(err);
    }
  }

  /**
   * @returns {number}
   */
  block() {
    return this._block;
  }


}

module.exports.BlockController = BlockController;
