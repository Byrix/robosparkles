// 
/* ROBOSPARKLES
script: shoutouts.js
version: 3.0.0
author: byrix
license: GPL-3.0 */

module.exports = class Shoutouts {
    #util; #settings; #responses;
    constructor(util) {
        this.#util = util;
        try{ var data = require('../data/shoutouts.json') }
        catch(err) { throw err }
        this.#responses = data ? data['responses'] : {
            "shoutoutDefault": "Generic shoutout message here! $[targetUrl]",
            "shoutoutPermission": " "
        };
        this.#settings = data ? data['settings'] : { "permission": 1 };
    }

    command(msg, user) {
        /* command(msg, user)
        Processes an incoming command relevant to this system
        :param msg: the incoming message containing the command
        :param user: the sending user
        :returns: none */
        let queryList = msg.message.split(" ")

        if( user.permission > this.#settings.permission ) { this.#util.sendMessage(msg.channel, this.#responses['shoutoutPermission']); return; }
        this.#shoutout(queryList[1], msg);
    }
    #parse(resp, msg, target) {
        resp = resp.replace(/\$\[target\]/i, target);
        resp = resp.replace(/\$\[targetUrl\]/i, `twitch.tv/${target.toLowerCase()}`);
        this.#util.sendMessage(msg.channel, resp);
    }

    #shoutout(target, msg) {
        target = target.startsWith("@") ? target.substring(1) : target;
        this.#util.db.query(`SELECT * FROM shoutouts WHERE name="${target}" ORDER BY RAND() LIMIT 1`, (err, res) => {
            if (err) throw err;

            if (res.length>0) this.#parse(res[0].response, msg, target);
            else this.#parse(this.#responses['shoutoutDefault'], msg, target);
        })
    }
}