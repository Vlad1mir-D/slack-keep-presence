const Slack = require('slack-node');
const logger = require('jethro');

const { RtmClient, CLIENT_EVENTS, RTM_EVENTS } = require('@slack/client');

class SlackPresence {
  constructor(token) {
    this.token = token;
    this.slack = new Slack(token);
    this.slackrtm = new RtmClient(token, {
      dataStore: false,
      useRtmConnect: true
    });
  }

  static log(msg, level, flag) {
    level = level || 'info';
    flag = flag || 'SlackPresence';
    logger(level, flag, msg);
  }

  get_me(callback) {
    SlackPresence.log('Getting my user id');
    return this.slack.api(
      'auth.test',
      function(err, response) {
        SlackPresence.log('Found ' + response.user_id);
        this.user_id = response.user_id;
        callback(response.user_id);
      }.bind(this)
    );
  }

  init() {
    this.get_me(this.start_presence.bind(this));
  }

  start_presence(uid) {
    this.slackrtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
      this.slackrtm.subscribePresence([uid]);
    });
    this.slackrtm.on(RTM_EVENTS.PRESENCE_CHANGE, this.handle_presence.bind(this));
    this.slackrtm.start({ batch_presence_aware: true });
  }

  handle_presence(data) {
    if (data.user !== this.user_id) return;
    SlackPresence.log('Presence change: ' + data.user + ' ' + data.presence);
    if (data.presence !== 'away') return;
    this.slack.api('users.getPresence', this.check_presence.bind(this));
  }

  check_presence(err, data) {
    if (!data['auto_away']) return;
    this.set_active();
  }

  set_active() {
    SlackPresence.log('Setting myself active');
    this.slack.api('users.setActive', function(err, response) {
      if (err) {
        SlackPresence(`Error setting presence: ${err}`);
      } else if (response.error) {
        SlackPresence(`Error setting presence: ${response.error}`);
      } else if (!response.ok) {
        SlackPresence.log('Set active not OK.');
      } else {
        SlackPresence.log('Set active success!');
        this.get_me();
      }
    });
  }
}

module.exports = SlackPresence;
