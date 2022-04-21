/* ROBOSPARKLES
script: bot.js 
version: 3.0.0 
author: byrix
license: GPL-3.0 */

require('dotenv').config();
const { Chat, Api } = require('twitch-js');
const axios = require('axios');
const fs = require('fs'), os = require('os');
const { util } = require('./systems');

const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

const onAuthenticationFailure = () => {
    return axios.post('https://id.twitch.tv/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
    }).then((res) => {
        let token = res.data.access_token
        const ENV_VARS = fs.readFileSync('./.env', 'utf-8').split(os.EOL);
        const target = ENV_VARS.indexOf(ENV_VARS.find((line) => { return line.match(new RegExp('AUTH_TOKEN')); }));
        ENV_VARS.splice(target, 1, `AUTH_TOKEN="${token}"`);
        fs.writeFileSync('./.env', ENV_VARS.join(os.EOL));
        return token;
    }).catch((err) => { console.error(err) });
}

const token = process.env.AUTH_TOKEN;
const username = 'robosparkles';


const run = async() => {
    const bot = new Chat({ token, username, onAuthenticationFailure });
    const channels = ['#byrix__'];

    const Systems = require('./systems');

    const util = new Systems.util(new Api({ token, clientId, onAuthenticationFailure }), sendMessage, deleteMessage),
    quote = new Systems.quote(util),
    moderation = new Systems.moderation(util),
    commands = new Systems.commands(util),
    shoutout = new Systems.shoutouts(util);

    await bot.connect();

    Promise.all(channels.map(channel => { bot.join(channel); bot.say(channel, "I'm here"); })).then(channelStates => {
        bot.on("PRIVMSG", privmsg => {
            moderation.checkUser(privmsg);

            util.db.query(`SELECT * FROM users WHERE id LIKE '${privmsg.tags.userId}'`, function (err, res, fields) {
                if (err) throw err;
                var user = res[0];

                if (moderation.validate(privmsg, user)) { bot.delete(privmsg.channel, privmsg.tags.id); bot.say(privmsg.channel, moderationResp) }

                if (!privmsg.message.startsWith("!")) { return; }
                switch(privmsg.message.split(" ")[0]) {
                    case "!bot": command(privmsg, user); break;
                    case "!quote": quote.command(privmsg, user); break;  
                    case "!moderation":  moderation.command(privmsg, user); break;
                    case "!so": shoutout.command(privmsg, user); break;
                    default: commands.command(privmsg, user); break;
                }
            });
        });

        bot.on("WHISPER", msg => {
            moderation.checkUser(msg);

            util.db.query(`SELECT * FROM users WHERE id LIKE '${msg.tags.userId}'`, function (err, res, fields) {
                if (err) throw err;
                var user = res[0];

                if (user.permission_level > 2 ) return; 

                let privmsg = {'message': msg.message, 'channel': '#byrix__', 'tags': { 'displayName': msg.tags.displayName, 'roomId': '000', 'userId': msg.tags.userId }};

                if (!msg.message.startsWith("!")) { return; }
                switch(msg.message.split(" ")[0]) {
                    case "!bot": command(privmsg, user); break;
                    case "!quote": quote.command(privmsg, user); break;  
                    case "!moderation":  moderation.command(privmsg, user); break;
                    case "!so": shoutout.command(privmsg, user); break;
                    default: commands.command(privmsg, user); break;
                }
            });
        })
    });

    function sendMessage(channel, msg) { 
        let msgList = msg.split("$[+]");
        for (let message of msgList) { bot.say(channel, message); }
    }
    function deleteMessage(channel, id) { bot.delete(channel, id) }
    function command(msg, user) {
        /* command(msg, user)
        Process incoming bot commands
        :param msg: the incoming command
        :param user: the sending user 
        :returns: none */
        if (user.permission_level > 0) return;

        let resp;
        switch(msg.message.split(" ")[1]) {
            case "marco": sendMessage(msg.channel, "Polo!"); break;
            case "status": 
                resp = `util: ${util ? true : false}`;
                resp += `; quote: ${quote ? true : false}`;
                resp += `; moderation: ${moderation ? true : false}`;
                resp += `; commands: ${commands ? true : false}`;
                resp += `; shoutouts: ${shoutout ? true : false}`;
                sendMessage(msg.channel, resp); break;
            case "user": 
                resp = `Name: ${user.name}; Permission: ${user.permission_level}`;
                sendMessage(msg.channel, resp); break;
            default: break;
        }
    }
}
run()
