const { dataStoreKeys } = require('./constants');
const { EventEmitter } = require('events');

class BlockController extends EventEmitter {

  static events = {
    BLOCK_INCREASE: 'BLOCK_INCREASE',
  };

  /**
   * @type {number}
   * @private
   */
  _blockInterval = 30000;

  /**
   * @type {number}
   * @private
   */
  _block = 0;

  /**
   * @type {DataStore|null}
   * @private
   */
  _dataStore = null;

  /**
   * @type {(err: any) => void}
   * @private
   */
  _handleError = console.error;

  /**
   * @param {DataStore} dataStore
   * @param {(err: any) => void} handleError
   */
  constructor(dataStore, handleError) {
    super();
    this._dataStore = dataStore;
    this._handleError = handleError || this._handleError;
  }

  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    this._block = this._dataStore.get(dataStoreKeys.BLOCK) || 12344;
    await this._increaseBlock();
    setInterval(() => {
      this._increaseBlock()
        .catch(this._handleError);
    }, this._blockInterval);
  }

  /**
   * @returns {Promise<number>}
   * @private
   */
  async _increaseBlock() {
    this._block++;
    await this._dataStore.set(dataStoreKeys.BLOCK, this._block);
    this.emit(BlockController.events.BLOCK_INCREASE, this._block);
    return this._block;
  }

  /**
   * @returns {number}
   */
  block() {
    return this._block;
  }


}

module.exports.BlockController = BlockController;
