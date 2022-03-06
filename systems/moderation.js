/* ROBOSPARKLES
script: moderation.js 
version: 2.0.0 
author: byrix 
license: GPL-3.0 */


module.exports = class Moderation {
    #util; #responses; #settings;

    constructor(util) {
        this.#util = util;
        this.#responses = {
            'invalid-link': "Please don't post links in chat!",
            'invalid-permission': "You don't have permission to do that!"
        }
        this.#settings = {
            "link": {
                "enabled": true,
                "perm_required": 2
            },
            "perm": {
                "use": 1,
                "edit": 0
            }
        }
    }

    checkUser(msg) {
        /* checkUser(msg) 
        Checks if a user is in the database, updates their permissions if required
        :param msg: the message they sent, used to get their info
        :returns: none */

        // Add user to the database if they don't exist
        this.#util.db.query(`INSERT IGNORE INTO users SET id=${msg.tags.userId}, name="${msg.username}"`, (err, res) => { if (err) throw err });

        // Update the users info if required
        this.#util.db.query(`SELECT * FROM users WHERE id=${msg.tags.userId}`, function (err, res) {
            if (err) throw err;
            var user = res[0];
    
            if (user.permission_update < (new Date())) {
                let newLevel;
                let newInterval = 6;
                if (user.permission_level===0) { newLevel=0; }
                else if (msg['tags']['isModerator']) { newLevel=1; }
                else if (msg['tags']['badges']['vip']) { newLevel=2; }
                else if (msg['tags']['subscriber']==='1') {
                    newLevel=3;
                    newInterval=1;
                }
                db.query(`UPDATE users SET permission_level=${newLevel},check_permissions=DATE_ADD(NOW(), INTERVAL ${newInterval} MONTH`, function (err, res) {if (err) throw err});
            }
        })
    }

    validate(msg, user) {
        /*validate(msg, user)
        Runs a serious of moderation checks on a sent message
        :param msg: the message sent
        :param user: the sending user
        :returns: none */

        // Check if user is on the whitelist
        this.#util.db.query(`SELECT * FROM whitelist WHERE user_id=${user.id}`, (err, res) => {
            if (err) throw err;
            let validWhitelist = true;

            if (res.length>0) {
                // If user is on the whitelist, check if it has expired or is still currently valid
                if (res[0].expired===0 && (new Date()) > (new Date(res[0].expiry))) { 
                    this.#util.db.query(`UPDATE whitelist SET expired=1 WHERE user_id=${user.id}`, (err, res) => { if (err) throw err; });
                }
                validWhitelist = res[0].expired===1
            } else { validWhitelist = false; }

            if (!validWhitelist) {
                // If not on the whitelist, or if it has expired, run the validation
                this.#validateLinks(msg, user);
                //TODO: Caps, symbols, words, emotes, (hate?)
            }
        });
    }
    #validateLinks(msg, user) {
        /* validateLinks(msg, user)
        Checks a message for urls and checks if the sending user had permission to post links
        :param msg: the message to check
        :param user: the user table entry of the sending user
        :returns: none */
        if (!this.#settings.link.enabled || this.#settings.link.perm_required >= user.permission_level) { return; }

        if (/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i.test(msg.message)) { 
            this.#util.deleteMessage(msg.id, msg.channel);
            this.#util.sendMessage(msg.channel, this.#responses["invalid-link"]);
        }
    }

    command(msg, user) { 
        /* command(msg, user)
        Process incoming commands relating to this system
        :param msg: the command message
        :param user: the sending user
        :returns: none */
        if (this.#settings.perm.use < user.permission_level) { this.#util.sendMessage(msg.channel, this.#responses['invalid-permission']); return; }

        var msgList = msg.message.split(" "),
        action = msgList[1];

        switch(action) {
            case "whitelist": 
                this.#util.db.query(`SELECT * FROM users WHERE name="${msgList[2].startsWith("@") ? msgList[2].substring(1) : msgList[2]}"`, (err, res) => {
                    if (err) throw err;
                    if (res.length>0) { this.#whitelist(res[0], msgList[3] ? msgList[3] : false, msg.channel); } 
                    else { this.#util.sendMessage(msg.channel, "Unknown user"); }
                });
                break;
            case "unwhitelist":
                this.#util.db.query(`SELECT * FROM users WHERE name="${msgList[2].startsWith("@") ? msgList[2].substring(1) : msgList[2]}"`, (err, res) => {
                    if (err) throw err;
                    if (res.length>0) { this.#util.db.query(`UPDATE whitelist SET expired=1 WHERE user_id=${res[0].id}`, (err, res) => { if (err) throw err }); } 
                });
                break;
            case "check":
                this.#checkWhitelist(msg.channel, msgList[2].startsWith("@") ? msgList[2].substring(1) : msgList[2]);
                break;
            default: break;
        }
    }

    #whitelist(user, duration=false, channel) {
        /* whitelist(user, duration)
        Adds a specified user to the whitelist
        :param user: the user to be added
        :param duration: how long to whitelist them for
        :param channel: the channel to send the resposne to
        :returns: none */
        let query = duration ? `REPLACE INTO whitelist SET user_id=${user.id}, expiry=DATE_ADD(NOW(), INTERVAL ${duration} SECOND)` : `REPLACE INTO whitelist SET user_id=${user.id}`;
        
        this.#util.db.query(query, (err, res) => {
            if (err) throw err;
            this.#util.sendMessage(channel, `User ${user.name} added to whitelist for ${duration}.`);
        })
    }
    #checkWhitelist(channel, user) {
        /* checkWhitelist(channel, user) 
        Check if a user has a valid entry on the whitelist
        :param channel: the channel to send the resposne to
        :param user: the user to check
        :returns: none */
        this.#util.db.query(`SELECT * FROM whitelist WHERE user_id IN (SELECT id FROM users WHERE name="${user.startsWith("@") ? user.substring(1) : user}")`, (err, res) => {
            if (err) throw err;
            if (res.length>0) { this.#util.sendMessage(channel, `${user} is on the whitelist`) }
            else { this.#util.sendMessage(channel, `${user} is not whitelisted`)}
        })
    }
}