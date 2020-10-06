const obyte = require('obyte');
const kbyte = require('kbyte');
const Promise = require('bluebird');
const writer = require('./writer');
const db = require('./db');
const checkpoint = require('./checkpoint.json');

const client = new kbyte.Client(process.env.RELAY_WS || 'wss://obyte.org/bb');

class Replay {
  constructor(address) {
    this.client = new obyte.Client(address, { reconnect: true });
    this.client.subscribe((err, message) => {
      if (err) return console.error(err);
      /** Index unstable units */
      // console.log('Subscribe', message);
      if (message[0] && message[1]) {
        switch (message[0]) {
          case 'request':
            if (message[1].tag && message[1].command) {
              if (message[1].command === 'subscribe') {
                client.send(['response', {
                  tag: message[1].tag,
                  command: message[1].command,
                  response: {
                    error: "I'm light, cannot subscribe you to updates",
                  },
                }]);
                console.log('Subscribe request');
              } else if (message[1].command === 'heartbeat') {
                client.send(['response', {
                  tag: message[1].tag,
                  command: message[1].command,
                  response: null,
                }]);
                console.log('Heartbeat request');
              } else if (message[1].command.startsWith('light/')) {
                client.send(['response', {
                  tag: message[1].tag,
                  command: message[1].command,
                  response: {
                    error: "I'm light myself, can't serve you",
                  },
                }]);
                console.log('Light wallet request', message);
              } else {
                console.error('unhandled command', message);
              }
            } else {
              console.error('unhandled request', message);
            }
            break;
          case 'justsaying':
            if (message[1].subject && message[1].subject === 'joint') {
              const objUnit = message[1].body.unit;
              writer.indexUnstableUnit(objUnit).then(() => {
                console.log('Indexed unstable unit messages', objUnit.unit);
              });
            } else {
              console.error('unhandled justsaying', message);
            }
            break;
          default:
            console.error('unhandled message', message);
            break;
        }
      } else {
        console.error('unknown message', message);
      }
      return true;
    });
  }

  start() {
    this.init().then(() => {
      this.replay();
    });
  }

  init() {
    return Promise.all([
      this.client.api.subscribe({ subscription_id: '1', last_mci: 0, library_version: '1.0' }),
      this.client.api.getWitnesses(),
    ]).then((res) => {
      [this.subscribe, this.witnesses] = res;
      return new Promise(resolve => resolve());
    });
  }

  replay() {
    db.query('SELECT mci FROM last_known_mci').then((mci) => {
      console.log('Last known mci', mci[0].mci);
      if (mci[0].mci === 0) {
        console.log('Got checkpoint');
        this.handleCatchup(checkpoint).then(() => {
          console.log('Finish checkpoint, replay again');
          this.replay();
        });
      } else {
        this.client.api.catchup({
          last_stable_mci: mci[0].mci,
          last_known_mci: mci[0].mci + 1,
          witnesses: this.witnesses,
        }).then((catchup) => {
          console.log('Got catchup');
          this.handleCatchup(catchup).then(() => {
            console.log('Finish, will wait and replay again');
            Promise.delay(10000).then(() => this.replay());
          });
        }).catch((err) => {
          console.error('Error catchup, will wait retry', err);
          Promise.delay(60000).then(() => this.replay());
        });
      }
    }).catch(err => console.error('Error query last_known_mci', err));
  }

  handleCatchup(catchup) {
    /** Get Hash Tree */
    const lastBallJoints = catchup.stable_last_ball_joints ? catchup.stable_last_ball_joints.slice().reverse() : [];
    // const unstableMcJoints = catchup.unstable_mc_joints || [];
    // eslint-disable-next-line consistent-return
    return Promise.each(lastBallJoints, (joint, index) => {
      if (index !== 0) {
        return this.client.api.getHashTree({
          from_ball: lastBallJoints[index - 1].ball,
          to_ball: joint.ball,
        }).then((hashTree) => {
          console.log('Hash tree loaded from', lastBallJoints[index - 1].unit.main_chain_index, 'to', joint.unit.main_chain_index);

          /** Get Joints */
          const promises = hashTree.balls.map(ball => this.client.api.getJoint(ball.unit));
          return Promise.all(promises).then((joints) => {
            console.log('Joints loaded');
            return writer.indexJoints(joints).then(() => {
              console.log('handleCatchup indexJoints success');
            }).catch((err) => {
              console.error('handleCatchup indexJoints error', err);
            });
          });
        });
      }
    });
  }
}

const replay = new Replay(process.env.RELAY_WS || 'wss://obyte.org/bb');
replay.start();
