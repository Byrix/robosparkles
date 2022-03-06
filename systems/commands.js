/* ROBOSPARKLES
script: commands.js
version: 2.0.0
author: byrix
license: GPL-3.0 */

const axios = require('axios');

module.exports = class Commands {
    #util; #responses; #settings;

    constructor(util) {
        this.#util = util;
        try{ var data = require('../data/commands.json') }
        catch(err) { throw err }
        this.#responses = data ? data['responses'] : {
            "commandUnknown": "I don't know that command!",
            "commandAdd": "I've added the $[commandTrigger] command!",
            "commandRemove": "I've removed the $[commandTrigger] command!",
            "commandUpdate": "I've updated the $[commandTrigger] command!",
            "commandPermissions": "You don't have permission to do that, $[user]"
        };
        this.#settings = data ? data['settings'] : { "permissions": { "edit": 1 } };
    }

    command(msg, user) {
        let action = msg.message.split(" ")[1];

        switch(action) {
            case "add": this.#addCommand(msg, user); break;
            case "remove": this.#removeCommand(msg, user); break;
            case "edit": this.#editCommand(msg, user); break;
            default:
                this.#util.db.query(`SELECT * FROM commands WHERE \`trigger\`="${msg.message.split(" ")[0]}"`, (err, res) => {
                    if (err) throw err;
        
                    if (res.length === 0) { this.#util.sendMessage(msg.channel, this.#responses['commandUnknown']); return; }
                    let command = res[0];
        
                    if (command.enabled===0) { return; }
                    if (user.permission_level > command.permission) { this.#util.sendMessage(msg.channel, this.#responses['commandPermissions']); return; }
                    if (this.#util.checkCooldown(command.lastCall, command.cooldown)) { this.#util.sendMessage(msg.channel, this.#responses['commandCooldown']); return; }
                
                    // TODO: User cooldown
        
                    this.#parse(command.response, msg);
                });
                break;
        }
    }
    #parse(resp, msg) {
        resp=resp.replace(/\$\[time\]/i, (new Date()).toString());
        resp=resp.replace(/\$\[user\]/i, msg.tags.displayName);
        resp=resp.replace(/\$\[userId\]/i, msg.tags.userId);
        if (resp.search(/\$\[target\]/i)>-1) resp=resp.replace(/\$\[target\]/i, msg.message.split(" ")[1].startsWith("@") ? msg.message.split(" ")[1].substring(1) : msg.message.split(" ")[1]);
        resp=resp.replace(/\$\[channel\]/i, msg.channel.substring(1));
        resp=resp.replace(/\$\[channelId\]/i, msg.tags.roomId);
        if (resp.search(/\$\[commandTrigger\]/i)>-1) resp=resp.replace(/\$\[commandTrigger\]/i, msg.message.split(" ")[2]);

        let apiCheck = resp.match(/\$\[api (?<json>json )?(?<url>(?:https?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*))\]/i);
        if (apiCheck) {
            if (apiCheck.groups.json) { axios.get(apiCheck.groups.url).then((res) => {
                resp = resp.replace(/\$\[api (?<json>json )?(?<url>(?:https?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*))\]/i, JSON.stringify(res.data))
                this.#parse(resp, msg); 
            })} 
            else { axios.get(apiCheck.groups.url).then((res) => { this.#parse(resp.replace(/\$\[api (?<json>json )?(?<url>(?:https?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*))\]/i, res), msg); return; })} 
            return;
        }

        let twitchCheck = resp.match(/\$\[twitch (?<url>[a-z/]*) (?<options>\{.*\})\]/i)
        if (twitchCheck) {
            this.#util.twitchApi.get(twitchCheck.groups.url, JSON.parse(twitchCheck.groups.options))
                .then((res) => { 
                    resp = resp.replace(/\$\[twitch (?<url>[a-z/]*) (?<options>\{.*\})\]/i, JSON.stringify(res.data[0]));
                    this.#parse(resp, msg);
                });
            return;
        }

        let evalCheck = resp.match(/\$\[eval (?<evalCode>.*)\]/i);
        if (evalCheck) {
            let res = eval(evalCheck.groups.evalCode);
            resp = resp.replace(/\$\[eval .*\]/i, res);
        }
        this.#util.sendMessage(msg.channel, resp);
    }
    #addCommand(msg, user) {
        if (user.permission > this.#settings.permissions.edit) { this.#util.sendMessage(msg.channel, this.#responses['commandPermissions']); return; }

        let queryList = msg.message.split(" "),
        cutLength = 13+queryList[2].length; 

        if (queryList[3].startsWith("+")) { 
            let permission=queryList[3]; cutLength+=3; 
            switch(permission) {
                case "+a": permission = 0; break;
                case "+m": permission = 1; break;
                case "+v": permission = 2; break;
                case "+s": permission = 3; break;
                case "+e": permission = 4; break;
            }
            this.#util.db.query(`INSERT INTO commands (\`trigger\`, \`response\`, \`permission\`) VALUES ("${queryList[2]}", "${msg.message.substring(cutLength)}", ${permission})`, (err, res) => {
                if (err) throw err;
                this.#parse(this.#responses['commandAdd'], msg);
            });
        } else {
            this.#util.db.query(`INSERT INTO commands (\`trigger\`, \`response\`) VALUES ("${queryList[2]}", "${msg.message.substring(cutLength)}")`, (err, res) => {
                if (err) throw err;
                this.#parse(this.#responses['commandAdd'], msg);
            });
        }
    }
    #removeCommand(msg, user) {
        if (user.permission > this.#settings.permissions.edit) { this.#util.sendMessage(msg.channel, this.#responses['commandPermission']); return; }
        let trigger = msg.message.split(" ")[2];
        this.#util.db.query(`DELETE FROM commands WHERE \`trigger\`="${trigger}"`, (err, res) => {
            if (err) throw err;
            this.#parse(this.#responses['commandRemove'], msg);
        })
    }
    #editCommand(msg, user) {
        if (user.permission > this.#settings.permissions.edit) { this.#util.sendMessage(msg.channel, this.#responses['commandPermission']); return; }
        let queryList = msg.message.split(" "),
        trigger = queryList[2],
        queryString = msg.message.substring(14+trigger.length);
        
        this.#util.db.query(`UPDATE commands SET response="${queryString}" WHERE \`trigger\`="${trigger}"`, (err, res) => {
            if (err) throw err;
            this.#parse(this.#responses['commandUpdate'], msg);
        })
    }
}