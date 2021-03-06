const express = require('express');
const cors = require('cors');
const _ = require('lodash');
const { DB } = require('./db');
const { User } = require('./types/user');
const { SessionToken } = require('./types/session-token');
const dayjs = require('dayjs');
const { BlockController } = require('./block-controller');
const { AccountController } = require('./account-controller');
const bodyParser = require('body-parser');
const { POCKET_MINIMUM_STAKE } = require('./constants');
const { ValidatorNode } = require('./types/validator-node');
const { generateUrl, generateId} = require('./util');
const { Hex } = require('@pokt-network/pocket-js');
const math = require('mathjs');

const { bignumber } = math;

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
      'register',
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
        .post('/api/v1/register', this.register)
        .post('/api/v1/unlock', this.unlock)
        .get('/api/v1/nodes', this.getNodes)
        .post('/api/v1/node/:address/unstake', this.unstakeValidator)
        .get('/api/v1/node/:address', this.getNode)
        .post('/api/v1/stake_validator', this.stakeValidator)
        .listen(this._port, () => {
          this._logInfo(`Server listening at port ${this._port}`);
          resolve();
        });
    });
  }

  async register(req, res) {
    try {
      const { body } = req;
      const isJson = req.is('application/json');
      if(!isJson || !body) {
        res.status(400);
        res.send('Request must be of type application/json and contain a valid JSON body.');
      } else if(!body.invitation || !_.isString(body.invitation)) {
        res.status(400);
        res.send('Request body must include an invitation string.');
      } else if(!body.password || !_.isString(body.password)) {
        res.status(400);
        res.send('Request body must include a password string.');
      } else if(!body.address || !_.isString(body.address)) {
        res.status(400);
        res.send('Request body must include an address string.');
      } else if(!Hex.validateAddress(body.address)) {
        res.status(400);
        res.send('Invalid POKT address.');
      } else {
        const [ invitation ] = await this._db.invitations.find({invitation: body.invitation});
        if(!invitation || !invitation.valid) {
          res.status(401);
          res.send('No valid invitation found.');
        } else {
          const userId = generateId();
          await this._db.invitations.update({invitation: invitation.invitation}, {$set: {
              valid: false,
              redeemedByUser: userId,
            }});
          const user = new User({
            id: userId,
            address: body.address,
            password: body.password,
          });
          await this._db.users.insert(user);
          res.type('application/json');
          res.send({
            id: userId,
            password: user.password,
          });
        }

      }
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

  async unlock(req, res) {
    try {
      const { auth_id, auth_key } = req.headers;
      if(!auth_id || !auth_key)
        return res.sendStatus(401);
      const [ user ] = await this._db.users.find({id: auth_id});
      if(!user || (user && user.password !== auth_key))
        return res.sendStatus(401);
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
        reportBlock: reportBlock.toString(10),
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
      const { address } = req.params;
      const { auth_id } = req.headers;
      const [ n ] = await this._db.nodes.find({address, user: auth_id});
      if(!n) {
        res.status(404);
        return res.send(`Node ${address} for user ${auth_id} not found.`);
      }
      const reportBlock = this._blockController.block();
      const timestamp = new Date().toISOString();
      const balance = await this._accountController.getBalance(n.address);
      res.type('application/json');
      res.send({
        address: n.address,
        balance: balance,
        jailed: n.jailed,
        publicKey: n.publicKey,
        region: n.region,
        reportBlock: reportBlock.toString(10),
        staked: n.staked,
        stakedAmount: n.stakedAmount,
        stakedBlock: n.stakedBlock,
        timestamp,
        unstakeDate: n.unstakeDate,
        url: n.url,
      });
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
        res.send('Request must be of type application/json and contain a valid JSON body.');
      } else if(!body.password || !_.isString(body.password)) {
        res.status(400);
        res.send('Request body must include a password string.');
      }  else if(!body.stakeAmount || !_.isString(body.stakeAmount)) {
        res.status(400);
        res.send('Request body must include a stakeAmount string.');
      } else if(math.smaller(bignumber(body.stakeAmount), POCKET_MINIMUM_STAKE)) {
        res.status(400);
        res.send(`stakeAmount must be at least ${POCKET_MINIMUM_STAKE.toString()} POKT.`);
      } else {
        const { password, stakeAmount } = body;
        const account = await this._accountController.create(password);

        this._logInfo(`Create validator ${account.address}`);

        const balanceRequired = math.add(bignumber(stakeAmount), bignumber(1)).toString();

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
      const { address } = req.params;
      const { auth_id } = req.headers;
      const [ n ] = await this._db.nodes.find({address, user: auth_id});
      if(!n) {
        res.status(404);
        return res.send(`Node ${address} for user ${auth_id} not found.`);
      }
      if(!n.staked) {
        res.status(400);
        return res.send(`Node ${address} is not staked.`);
      } else if(n.unstakeDate) {
        res.status(400);
        return res.send(`Node ${address} is already scheduled to be unstaked.`);
      }
      this._logInfo(`Unstake request for ${n.address}`);
      // const unstakeDate = dayjs().add(3, 'weeks').toISOString();
      const unstakeDate = dayjs().add(24, 'hours').toISOString();
      await this._db.nodes.update({address}, {$set: {unstakeDate}});
      this._logInfo(`Unstake scheduled for ${n.address} on ${unstakeDate}`);
      res.type('application/json');
      res.send({
        address,
        unstakeDate,
      });
    } catch(err) {
      this._handleError(err);
      res.sendStatus(500);
    }
  }

}

module.exports.APIServer = APIServer;
