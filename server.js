'use strict';

const express = require("express");
const fetch = require("node-fetch");
const redis = require("redis");
const bodyParser = require('body-parser');
const mysql = require('mysql');
const moment = require('moment');

const RedisDb = require('./util/redis.util');
const { DB_OPTIONS, GOAL_SERVE, BET365, REDIS_OPTIONS } = require('./env');

const PORT = Number(process.env.ONE_CRICKET_SERVER) || 4040;
const PORT_REDIS = process.env.PORT || 6379;

const connection = mysql.createConnection(DB_OPTIONS);
const redisClient = redis.createClient(REDIS_OPTIONS.port, REDIS_OPTIONS.host);

const redisDb = new RedisDb(REDIS_OPTIONS);

var batting_team;

const app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const set = (key, value) => {
    redisClient.set(key, JSON.stringify(value));
}

//****  redis  cache *********//
const get = (req, res, next) => {
    let key = req.route.path;
    redisClient.get(key, (error, data) => {
        if (error) res.status(400).send(err);
        if (data !== null) {
            console.log('inside redis cache')

            res.status(200).send(JSON.parse(data));
        }
        else next();
    });
}

//****  upcoming matches *********//
app.get("/upcoming/matches", get, (req, res) => {
    fetch(`https://api.b365api.com/v1/bet365/upcoming?sport_id=3&token=${BET365.token}`)
        .then(res => res.json())
        .then(json => {
            set(req.route.path, json, 'EX', 60 * 60 * 24);
            res.status(200).send(json);
        })
        .catch(error => {
            console.error(error);
            res.status(400).send(error);
        });
});

//****  upcoming Preodds *********//
app.get("/upcoming/preodds", (req, res) => {
    const FI = req.param('FI');

    if (!FI) {
        return res.status(404).send({ status: 0, error: 'FI ID is expected/' });
    }

    console.log(FI)

    redisClient.get(FI, (error, data) => {
        if (error) res.status(400).send(err);
        if (data !== null) {
            console.log('inside redis cache')
            res.status(200).send(JSON.parse(data));
        }
        else {
            console.log('ouside redis cache')
            fetch(`https://api.b365api.com/v3/bet365/prematch?token=${BET365.token}&FI=` + FI)
                .then(res => res.json())
                .then(json => {
                    set(FI, json, 'EX', 60 * 60 * 24);
                    res.status(200).send(json);
                })
                .catch(error => {
                    console.error(error);
                    res.status(400).send(error);
                });

        };
    });
});

//****  inplay matches *********//
app.get("/inplay/matches", (req, res) => {
    fetch(`https://api.b365api.com/v1/bet365/inplay_filter?sport_id=3&token=${BET365.token}`)
        .then(res => res.json())
        .then(json => {
            res.status(200).send(json);
        })
        .catch(error => {
            console.error(error);
            res.status(400).send(error);
        });
});

//****  inplay  liveodds *********//
app.get("/inplay/liveodds", (req, res) => {
    const FI = req.param('FI');

    if (!FI) {
        return res.status(404).send({ status: 0, error: 'FI ID is expected/' });
    }

    fetch(`https://api.b365api.com/v1/bet365/event?token=${BET365.token}&FI=` + FI)
        .then(res => res.json())
        .then(json => {
            for (var i = 0; i < json['results'].length; i++) {
                // here jsonObject['sync_contact_list'][i] is your current "bit"
                var x = json['results'][1];
                console.log(x + "x value");
            }
            res.status(200).send(json);
        })
        .catch(error => {
            console.error(error);
            res.status(400).send(error);
        });
});

//****  live score and suspend status *********//
const goalservelive = (req, res, next) => {
    let key = req.route.path;
    redisClient.get('goalservelive', (error, data) => {
        if (error) res.status(400).send(err);
        if (data !== null) {

            console.log('inside redis cache')

            res.status(200).send(JSON.parse(data));
        }
        else next();
    });
}

app.get("/goalserve/live", async (req, res) => {
    const hometeam = req.param('hometeam');
    const vistorteam = req.param('vistorteam');

    res.contentType('application/json');

    try {
        const results = await redisDb.get('goalServeLive');
        const scores = results ? JSON.parse(results) : [];

        if (hometeam || vistorteam) {

            if (Array.isArray(scores)) {
                const result = scores.find(sc => sc.homeTeam === hometeam || sc.visitorTeam === vistorteam);

                if (!result) return res.status(404).send({ error: 'No scores found for given teams', hometeam, vistorteam });

                return res.send(result);
            }

            if (scores.homeTeam === hometeam && scores.visitorTeam === vistorteam) {
                return res.send(result);
            } else {
                return res.status(404).send({ error: 'No scores found for given teams', hometeam, vistorteam });
            }
        }

        return res.send(results);
    } catch (err) {
        console.log('There was an error while getting live scores.');
        res.status(500).send({ message: 'There was an error while getting live scores.', err });
    }
});

//****  status fininshed  *********//
app.get("/goalserve/fininshed", (req, res) => {
    return res.status(404).send({ status: 0, message: 'API isn\'t needed any more.' });
});

//****  port  *********//
const live = (req, res, next) => {
    let key = req.route.path;
    redisClient.get('liveodd', (error, data) => {
        if (error) res.status(400).send(err);
        if (data !== null) {
            console.log('inside redis cache')
            res.status(200).send(JSON.parse(data));
        }
        else next();
    });
}

app.get("/inplay/overodds", live, (req, res) => {
    const FI = req.param('FI');

    if (!FI) {
        return res.status(400).send({ status: 0, message: 'FI is a mandatory param.' });
    }

    const hometeam = req.param('hometeam');
    const vistorteam = req.param('vistorteam');

    let temptype = [];
    let temp;
    let temp1;
    let result;
    const arr = [];
    var obj = {};

    fetch(`https://api.b365api.com/v1/bet365/event?token=${BET365.token}&FI=` + FI)
        .then(res => res.json())
        .then(json => {
            const category = json['results'];
            var flag = 'yes';
            for (let i = 0; i < category[0].length; i++) {
                if (category[0][i].type == "MG") {
                    const NA1 = category[0][i].NA;

                    //console.log(NA);
                    // console.log(NA.includes('Match Winner 2-Way')|| 'Runs Odd/Even' ||'Overs Runs'||'th Over,');
                    if (NA1.includes('Match Winner 2-Way')) {
                        const NA = category[0][i];
                        flag = 'yes';
                        // console.log("inseide true"+flag);
                        temp = temp + '{"oddname:"' + NA + '",';
                        arr.push(NA);
                        // obj.'oddname'+i=NA;
                        //  console.log(temp);
                        // obj.'oddname'+i=NA;
                    }

                    else if (NA1.includes('Runs Odd/Even')) {
                        const NA = category[0][i];
                        flag = 'yes';
                        temp = temp + '{"oddname:"' + NA + '",';
                        // console.log("inseide true"+flag);
                        //   console.log(temp);
                        arr.push(NA);
                        // obj.'oddname'+i=NA;
                    }

                    /* else if(NA1.includes('Overs Runs')){
                                flag='yes'; 
                           temp=temp + '{"oddname:"'+NA+'",'; 
                           // 	console.log(temp);
                                   arr.push(NA);
                                    obj.'oddname'+i=NA;
                     }*/

                    else if (NA1.includes('th Over,' || 'st Over,')) {
                        flag = 'yes';
                        const NA = category[0][i];
                        temp = temp + '{"oddname:"' + NA + '",';
                        // console.log("inseide true"+flag);
                        //  console.log(temp);
                        arr.push(NA);
                        ////  obj.'oddname'+i=NA;
                    }

                    else if (NA1.includes('rd Over,' || 'st Over,')) {
                        flag = 'yes';
                        const NA = category[0][i];
                        temp = temp + '{"oddname:"' + NA + '",';
                        // console.log("inseide true"+flag);
                        //  console.log(temp);
                        arr.push(NA);
                        //  obj.'oddname'+i=NA;
                    }

                    else if (NA1.includes('st Over,')) {
                        flag = 'yes';
                        const NA = category[0][i];
                        temp = temp + '{"oddname:"' + NA + '",';
                        arr.push(NA);
                        //obj.'oddname'+i=NA;

                        // console.log("inseide true"+flag);

                        //  console.log(temp);
                    } else {
                        flag = "no";
                        //console.log("inseide else"+flag);
                    }
                }

                if (flag == 'yes') {

                    if (category[0][i].type == "PA") {

                        if (category[0][i].OR == 0) {
                            const NA = category[0][i];
                            //console.log(category[0][i].NA);
                            const OD = category[0][i].OD;
                            arr.push(NA);
                            //  //   console.log(temp);
                        }

                        if (category[0][i].OR == 1) {
                            const NA = category[0][i];
                            const OD = category[0][i].OD;
                            temp = temp + '"' + NA + '"' + ":" + '"' + OD + '"' + '},';
                            arr.push(NA);
                            // arr.push(OD);
                            // obj.PA+i=NA;
                            // obj.PA+i=OD;
                        }
                    }
                }
            }
            // var result = (temp.replace("undefined","")).slice(0, -1);
            res.status(200).send(JSON.stringify({ arr }));
        })
        .catch(error => {
            console.error(error);
            res.status(400).send(error);
        });
});

//****  port  *********//
app.get("/daily/update", (req, res) => {
    const token = req.param('token');
    var userid = req.param('userid');
    console.log(userid)
    var results;
    try {
        var created = moment().format('YYYY-MM-DD hh:mm:ss')
        connection.query("INSERT INTO transection ( user_id,amount,type,transaction_status,transection_mode,created_date) VALUES('" + userid + "','100','bonus','SUCCESS','bonus_amount','" + created + "')", (err, rows) => {
            if (err) return res.status(500).send({ success: 0, err });
            console.log('The data from users table are: \n', rows);
            res.status(200).send(JSON.stringify({ 'success': '1' }));
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});

//****  port  *********//
app.get("/global/leader", (req, res) => {
    const token = req.param('token');
    var userid = req.param('userid');

    if (!userid) {
        return res.status(400).send({status:0, message: 'userid is a mandatory field.'});
    }
    console.log(userid)
    var results;

    try {
        connection.query("Select * FROM main_leaderboard ORDER BY `rank` ASC limit 0,10", (err, result, fields) => {
            if (err) return res.status(500).send({ success: 0, err });
            console.log('The data from users table are: \n', result);

            res.status(200).send(JSON.stringify({ result }));
        });
    }
    catch (error) {
        console.error(error);
        res.status(400).send(error);
    }
});

//****  leaderboard  *********//
app.get("/game/leader", (req, res) => {
    const token = req.param('token');
    var fi = req.param('fi');
    console.log(fi)
    var results;

    try {
        connection.query("Select * FROM gameleaderboard where fid='" + fi + "' ORDER BY `rank` ASC limit 0,10", (err, result, fields) => {
            if (err) return res.status(500).send({ success: 0, err });
            // console.log('The data from users table are: \n', result);

            res.status(200).send(JSON.stringify({ result }));
        });
    }
    catch (error) {
        console.error(error);
        res.status(400).send(error);
    }
});

//**** Game leaderboard  *********//
app.listen(PORT, async () => {
    console.log(`Server up and running on ${PORT}`);
    await redisDb.connect(REDIS_OPTIONS);
});
