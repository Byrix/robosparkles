/* ROBOSPARKLES
script: quotes.js
version: 3.0.0
author: byrix
license: GPL-3.0 */

const { default: axios } = require('axios');

module.exports = class Quotes {
    #util; #responses; #settings;

    constructor(util) {
        this.#util = util;
        var data = this.#util.readFile('C:/Users/Sean/Desktop/RoboSparkles/robosparkles-3.0/twitch/data/quotes.json')
        this.#settings = data['settings'];
        this.#responses = data['responses'];
    }

    command(msg, user) {
        let cutLength, prmGroup, mList = msg.message.split(" ");
	
        // Validate command
        switch (mList[0]) {
            case "!addquote":
            case "!quoteadd":
                mList[0] = "add"; cutLength=10; prmGroup='add'; break;
            case "!editquote":
            case "!quoteedit":
                mList[0] = "edit"; cutLength=11; prmGroup='edit'; break;
            case "!removequote":
            case "!quoteremove":
                mList[0] = "remove"; cutLength=13; prmGroup='edit'; break;
            default:
                mList.splice(0,1);
                switch(mList[0]) {
                    case "add": cutLength=11; prmGroup='add'; break;
                    case "edit": cutLength=12; prmGroup='edit'; break;
                    case "remove": cutLength=14; prmGroup='edit'; break;
                    default: cutLength=7; prmGroup='call'; break;
                }
                break;
        }
        
        // Check cooldown and permission
        if (user.permission_level > this.#settings['permissions'][prmGroup]) return;
        if (this.#util.checkCooldown(this.#settings['lastCalls'][prmGroup], this.#settings['cooldowns'][prmGroup])) return;
        
        // Call appropriate subscript
        switch(mList[0]) {
            case "add":
                this.#addQuote(msg.message.substring(cutLength), user, msg);
                break;
            case "edit":
                this.#editQuote(msg.message.substring(cutLength), msg);
                break;
            case "remove":
                this.#removeQuote(msg.message.substring(cutLength), msg);
                break;
            default: 
                this.#getQuote(msg.message.substring(cutLength), msg); 
                break;
        }
	
        // Update cooldown data
        this.#settings['lastCalls'][prmGroup] = +new Date;
        this.#util.saveFile({'settings': this.#settings, 'responses': this.#responses}, 'C:/Users/Sean/Desktop/RoboSparkles/robosparkles-3.0/twitch/data/quotes.json');
    }
    #addQuote(quote, user, msg) {
        this.#util.twitchApi.get('channels', { search: { broadcaster_id: +msg.tags.roomId }}) 
            .then(resp => resp['data'][0]['gameName'])
            .then(game => {
                game = game ? game : "Unknown";
                this.#util.db.query(`INSERT INTO quotes (quote, author, game) VALUES ("${quote}", ${user.id}, "${game}");`, (err, res) => { if (err) throw err });
            }).catch(error => {
                console.log(`ERROR: addQuote: ${error}`);
                this.#util.db.query(`INSERT INTO quotes (quote, author) VALUES ("${quote}", ${user.id});`, (err, res) => { if (err) throw err });
                //cb['sendDiscord'](`> ${quote}`);
            }).finally(() => {
                //let response = this.#responses.quoteAdd;
                let response = `New quote #$[quoteRef]! $[quote]`
                response = response.replace(/\$\[quote\]/gi, quote);
                if (/\$\[quoteRef\]/gi.test(response)) {
                    this.#util.db.query(`SELECT COUNT(id) AS length FROM quotes`, (err, res) => {
                        if (err) throw err;
                        response = response.replace(/\$\[quoteRef\]/, res[0].length);
                        this.#parse(response, msg);
                    });
                } else { this.#parse(response, msg);; }

                // this.#util.twitchApi.post('streams/markers', { body: { user_id: msg.tags.roomId, description: quote.substring(0,Math.min(quote.length, 139)) } })
                //     .catch(err => { throw err });
                if (this.#settings.sendDiscord) {
                    this.#util.db.query(`SELECT * FROM quotes ORDER BY id DESC LIMIT 1`, (err, res) => {
                        if (err) throw err;
                        let quote = res[0], 
                        msgContent = quote.game==="Unknown" ? `> ${quote.quote}` : `> ${quote.quote}\n${quote.game}`;

                        axios.post(`https://discord.com/api/channels/${this.#settings.discordId}/messages`, {
                            content: msgContent
                        },{
                            headers: {
                                'Authorization': 'Bot ODc2ODE5MjMyOTc1OTA4OTE1.YRpniw.VUaN4l2fJ2mjRIgXISA-h3O7-rI',
                                'User-Agent': 'RoboSparkles (twitch.tv/robosparkles, v0.1)',
                                'Content-Type': "application/json"
                            }
                        }).then((res) => {
                            axios.get(`https://discord.com/api/channels/${this.#settings.discordId}`, {
                                headers: {
                                    'Authorization': 'Bot ODc2ODE5MjMyOTc1OTA4OTE1.YRpniw.VUaN4l2fJ2mjRIgXISA-h3O7-rI',
                                    'User-Agent': 'RoboSparkles (twitch.tv/robosparkles, v0.1)',
                                    'Content-Type': "application/json"
                                }
                            }).then((res) => {
                                this.#util.db.query(`UPDATE quotes SET \`discord_id\`="${res.data.last_message_id}" WHERE id=${quote.id}`, (err, res) => {
                                    if (err) throw err;
                                })
                            }).catch((err) => { throw err; });
                        }).catch((err) => { throw err; });
                    });
                }
            });
    }
    #getQuote(query=undefined, msg) {
        let sql;
        if (!query) sql = `SELECT * FROM quotes ORDER BY RAND() LIMIT 1`
        else if (parseInt(query)) sql = `SELECT * FROM quotes ORDER BY id LIMIT 1 OFFSET ${+query-1}`
        else sql = `SELECT * FROM quotes WHERE quote LIKE '%${query}%' ORDER BY RAND() LIMIT 1`
        
        this.#util.db.query(sql, (err,res) => { 
            if (err) throw err; 
            if (res[0]) {
                let quote = res[0], response = `${quote.quote} `;
                response += this.#settings['showGame'] ? `[${quote.game}] ` : '';
                response += this.#settings['showDate'] ? `[${quote.created_on}] ` : '';
                this.#parse(response, msg);
            } else { this.#parse(this.#responses['quoteNotFound'], msg) }
        });
    }
    #removeQuote(quote, msg) {
        this.#util.db.query(`SELECT * FROM quotes ORDER BY id LIMIT 1 OFFSET ${+quote-1}`, (err, res) => {
            if (err) throw err;
            let quote = res[0]
            this.#util.db.query(`DELETE FROM quotes WHERE id=${quote.id}`, (err,res) => { 
                if (err) throw err; 
                else this.#parse(this.#responses['quoteRemove'], msg);
            });
            if (quote.discord_id) {
                axios.delete(`https://discord.com/api/channels/${this.#settings.discordId}/messages/${quote.discord_id}`, {
                    headers: {
                        'Authorization': 'Bot ODc2ODE5MjMyOTc1OTA4OTE1.YRpniw.VUaN4l2fJ2mjRIgXISA-h3O7-rI',
                        'User-Agent': 'RoboSparkles (twitch.tv/robosparkles, v0.1)',
                        'Content-Type': "application/json"
                    }
                }).catch((err) => { throw err });
            }
        });
    }
    #editQuote(info, msg) {
        let quoteInd = info.split(" ")[0], newQuote = info.substring(quoteInd.length+1);

        this.#util.db.query(`SELECT * FROM quotes ORDER BY id LIMIT 1 OFFSET ${+quoteInd-1}`, (err, res) => { 
            if (err) throw err;
            let quote = res[0];
            this.#util.db.query(`UPDATE quotes SET quote="${newQuote}" WHERE id=${quote.id}`, (err, res) => { 
                if (err) throw err;
                else this.#parse(this.#responses['quoteEdit'], msg);
            });
            if (quote.discord_id) {
                axios.patch(`https://discord.com/api/channels/${this.#settings.discordId}/messages/${quote.discord_id}`, {
                    content: quote.game==="Unknown" ? `> ${newQuote}` : `> ${newQuote}\n${quote.game}`
                },{
                    headers: {
                        'Authorization': 'Bot ODc2ODE5MjMyOTc1OTA4OTE1.YRpniw.VUaN4l2fJ2mjRIgXISA-h3O7-rI',
                        'User-Agent': 'RoboSparkles (twitch.tv/robosparkles, v0.1)',
                        'Content-Type': "application/json"
                    }
                }).catch((err) => { throw err });
            }
        });
    }
    #parse(resp, msg) {
        if (resp.search(/\$\[quoteRef\]/i)>-1) {
            let match = msg.message.match(/(?<ref>[0-9]+)/);
            resp = resp.replace(/\$\[quoteRef\]/i, match.groups.ref);
        }
        this.#util.sendMessage(msg.channel, resp);
    }
}