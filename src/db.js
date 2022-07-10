const path = require('path');
const NEDB = require('nedb-promises');

class DB {

  /**
   * @type {NEDB}
   */
  invitations = null;

  /**
   * @type {NEDB}
   */
  nodes = null;

  /**
   * @type {NEDB}
   */
  users = null;

  /**
   * @type {NEDB}
   */
  tokens = null;

  /**
   * @param {string} dataDir
   */
  constructor(dataDir) {
    this.invitations = NEDB.create({filename: path.join(dataDir, 'invitations.db'), timestampData: true});
    this.nodes = NEDB.create({filename: path.join(dataDir, 'nodes.db'), timestampData: true});
    this.users = NEDB.create({filename: path.join(dataDir, 'users.db'), timestampData: true});
    this.tokens = NEDB.create({filename: path.join(dataDir, 'tokens.db'), timestampData: true});
  }

}

module.exports.DB = DB;
