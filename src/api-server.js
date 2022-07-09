const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const { DB } = require('./db');
const { User } = require('./types/user');
const {SessionToken} = require('./types/session-token');
const dayjs = require('dayjs');

class APIServer {

  /**
   * @type {DB}
   * @private
   */
  _db = null;

  _port = 3300;

  /**
   * @type {(info: string) => void}
   * @returns {void}
   * @private
   */
  _logInfo = console.log;

  /**
   * @type {(err: string|Error) => void}
   * @returns {void}
   * @private
   */
  _handleError = console.error;

  /**
   * @param {number} port
   * @param {DB} db
   * @param {(info: string) => void} logInfo
   * @param {(err: string|Error) => void} handleError
   */
  constructor(port, db, logInfo, handleError) {
    this._port = port || this._port;
    this._db = db;
    this._logInfo = logInfo || this._logInfo;
    this._handleError = handleError || this._handleError;
    _.bindAll(this, [
      'unlock',
      'getNodes',
      'getNode',
      'stakeValidator',
      'unstakeValidator',
    ]);
  }

  /**
   * @param req
   * @returns {Promise<boolean>}
   * @private
   */
  async _isAuthorized(req) {
    const { auth_id, auth_key } = req.headers;
    if(!auth_id || !auth_key)
      return false;
    const [ token ] = await this._db.tokens.find({user: auth_id, token: auth_key});
    if(!token || (token && dayjs().isAfter(dayjs(token.expiration)))) {
      return false;
    } else {
      return true;
    }
  }

  start() {
    return new Promise(resolve => {
      express()
        .use(cors())
        .get('/', (req, res) => {
          res.sendStatus(200);
        })
        .post('/api/v1/unlock', this.unlock)
        .get('/api/v1/nodes', this.getNodes)
        .get('/api/v1/node/:address', this.getNode)
        .post('/api/v1/stake_validator', this.stakeValidator)
        .post('/api/v1/unstake_validator', this.unstakeValidator)
        .listen(this._port, () => {
          this._logInfo(`Server listening at port ${this._port}`);
          resolve();
        });
    });
  }

  async unlock(req, res) {
    try {
      const { auth_id, auth_key } = req.headers;
      if(!auth_id || !auth_key)
        res.sendStatus(401);
      const [ rawUser ] = await this._db.users.find({id: auth_id});
      let user;
      if(rawUser) {
        user = new User(rawUser);
      } else {
        user = new User({
          id: auth_id,
          password: auth_key,
        });
        await this._db.users.insert(user);
      }
      if(user.password !== auth_key)
        res.sendStatus(401);
      await this._db.tokens.remove({user: auth_id}, {multi: true});
      const token = new SessionToken({user: auth_id});
      await this._db.tokens.insert(token);
      res.type('application/json');
      res.send({
        token: token.token,
        expiration: token.expiration,
      });
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

  async getNodes(req, res) {
    try {
      const isAuthorized = await this._isAuthorized(req);
      if(!isAuthorized)
        return res.sendStatus(401);
      res.sendStatus(200);
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

  async getNode(req, res) {
    try {
      const isAuthorized = await this._isAuthorized(req);
      if(!isAuthorized)
        return res.sendStatus(401);
      res.sendStatus(200);
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

  async stakeValidator(req, res) {
    try {
      const isAuthorized = await this._isAuthorized(req);
      if(!isAuthorized)
        return res.sendStatus(401);
      res.sendStatus(200);
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

  async unstakeValidator(req, res) {
    try {
      const isAuthorized = await this._isAuthorized(req);
      if(!isAuthorized)
        return res.sendStatus(401);
      res.sendStatus(200);
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

}

module.exports.APIServer = APIServer;
