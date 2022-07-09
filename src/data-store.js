const fs = require('fs-extra');

class DataStore {

  /**
   * @type {string}
   * @private
   */
  _dataPath = '';

  /**
   * @type {Object}
   * @private
   */
  _data = {};

  /**
   * @param {string} dataPath
   */
  constructor(dataPath) {
    this._dataPath = dataPath;
    if(fs.pathExistsSync(dataPath)) {
      this._data = fs.readJsonSync(dataPath);
    }
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async _saveData() {
    await fs.writeJson(this._dataPath, this._data, {spaces: 2});
  }

  /**
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    return this._data[key];
  }

  /**
   * @param {string} key
   * @param {any} value
   * @returns {Promise<any>}
   */
  async set(key, value) {
    this._data[key]  = value;
    await this._saveData();
    return value;
  }

}

module.exports.DataStore = DataStore;
