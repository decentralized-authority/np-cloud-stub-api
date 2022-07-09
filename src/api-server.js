const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const { DB } = require('./db');
const { User } = require('./types/user');
const {SessionToken} = require('./types/session-token');
const dayjs = require('dayjs');
const { BlockController } = require('./block-controller');
const { AccountController } = require('./account-controller');
const bodyParser = require('body-parser');
const {POCKET_MINIMUM_STAKE} = require('./constants');
const {ValidatorNode} = require('./types/validator-node');
const {generateUrl} = require('./util');

class APIServer {

  /**
   * @type {DB}
   * @private
   */
  _db = null;

  /**
   * @type {number}
   * @private
   */
  _port = 3300;

  /**
   * @type {BlockController|null}
   * @private
   */
  _blockController = null;

  /**
   * @type {AccountController|null}
   * @private
   */
  _accountController = null;

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
   * @param {BlockController} blockController
   * @param {AccountController} accountController
   * @param {(info: string) => void} logInfo
   * @param {(err: string|Error) => void} handleError
   */
  constructor(port, db, blockController, accountController, logInfo, handleError) {
    this._port = port || this._port;
    this._db = db;
    this._blockController = blockController;
    this._accountController = accountController;
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
        .use(bodyParser.urlencoded({ extended: false }))
        .use(bodyParser.text())
        .use(bodyParser.json())
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
      this._logInfo(`Unlock ${auth_id}`);
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
      const nodes = await this._db.nodes.find({user: req.headers.auth_id});
      const reportBlock = this._blockController.block();
      const timestamp = new Date().toISOString();
      const balances = await Promise
        .all(nodes.map(n => this._accountController.getBalance(n.address)));
      res.type('application/json');
      res.send(nodes.map((n, i) => ({
        address: n.address,
        balance: balances[i],
        jailed: n.jailed,
        publicKey: n.publicKey,
        region: n.region,
        reportBlock,
        staked: n.staked,
        stakedAmount: n.stakedAmount,
        stakedBlock: n.stakedBlock,
        timestamp,
        unstakeDate: n.unstakeDate,
        url: n.url,
      })));
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
      const { body } = req;
      const isJson = req.is('application/json');
      if(!isJson || !body) {
        res.status(400);
        res.send('Request must be of type application/json and include a valid JSON body.');
      } else if(!body.password || !_.isString(body.password)) {
        res.status(400);
        res.send('Request body must include a password string.');
      }  else if(!body.stakeAmount || !_.isString(body.stakeAmount)) {
        res.status(400);
        res.send('Request body must include a stakeAmount string.');
      } else if(BigInt(body.stakeAmount) < POCKET_MINIMUM_STAKE) {
        res.status(400);
        res.send(`stakeAmount must be at least ${POCKET_MINIMUM_STAKE.toString(10)} POKT.`);
      } else {
        const { password, stakeAmount } = body;
        const account = await this._accountController.create(password);

        this._logInfo(`Create validator ${account.address}`);

        const balanceRequired = (BigInt(stakeAmount) + BigInt(1)).toString(10);

        const node = new ValidatorNode({
          address: account.address,
          publicKey: account.publicKey,
          region: 'us-east',
          url: generateUrl(),
          user: req.headers.auth_id,
          stakeAmount,
          balanceRequired,
          password,
          privateKeyEncrypted: account.encryptedPrivateKey,
          rawPrivateKey: account.rawPrivateKey,
        });
        await this._db.nodes.insert(node);

        res.type('application/json');
        res.send({
          ...account,
          balanceRequired,
        });
      }
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
