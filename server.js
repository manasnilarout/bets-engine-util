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

        if (hometeam && vistorteam) {

            if (Array.isArray(scores)) {
                const result = scores.find(sc => sc.homeTeam === hometeam && sc.visitorTeam === vistorteam);

                if (!result) return res.status(404).send({ error: 'No scores found for given teams', hometeam, vistorteam });

                return res.send(result);
            }

            if (scores.homeTeam === hometeam && scores.visitorTeam === vistorteam) {
                return res.send(result);
            } else {
                return res.status(404).send({ error: 'No scores found for given teams', hometeam, vistorteam });
            }

            return res.status(404).send({ error: 'No scores found for given teams', hometeam, vistorteam });
        }

        return res.send(results);
    } catch (err) {
        console.log('There was an error while getting live scores.');
        res.status(500).send({ message: 'There was an error while getting live scores.', err });
    }
});

//****  status fininshed  *********//
app.get("/goalserve/fininshed", (req, res) => {
    console.log("insde call");
    fetch(`http://www.goalserve.com/getfeed/${GOAL_SERVE.token}/cricket/livescore?json=1`)
        .then(res => res.json())
        .then(json => {
            const category = json['scores']['category'];
            var cantsize = category.length;
            console.log(cantsize);
            var created = moment().format('YYYY-MM-DD hh:mm:ss')
            for (let i = 0; i < cantsize; i++) {
                var hometeam;
                var visitorteam;
                var result;
                var overended;
                var score;
                var post;
                var total;
                var total1;
                var goalid;
                var matchid;
                var matchdate;
                var over;
                var runs;
                var wickets;
                var matchdate;
                var matchtype;
                var won;
                var mom;
                var toss;
                var totalfours;
                var number = [];
                var firstiningfours = 0;
                var secondiningfourstotal = 0;
                var firstiningsixes = 0;
                var secondiningsixestotal = 0;
                var hundred_scored_inmatch = 'no';
                var fifty_scored_inmatch = 'no';
                var total_runs_in_match;
                var total_match_sixes;
                var total_match_fours;
                var first_innnings_score;
                var player_of_the_match;
                var batsman_to_score_a_fifty_in_the_match;

                const staus = category[i]['match'].status;
                console.log(staus);

                hometeam = category[i]['match'].localteam.name;

                if (staus == "Finished") {
                    connection.query("SELECT goalid FROM scoreext where hometeam='" + hometeam + "' and match_status='Finished'", (err, rows) => {
                        if (err) throw err;
                        if (rows.length == 0) {
                            console.log("finished");
                            goalid = category[i].id;
                            matchtype = category[i]['match'].type;
                            hometeam = category[i]['match'].localteam.name;
                            console.log(hometeam);
                            visitorteam = category[i]['match'].visitorteam.name;
                            console.log(visitorteam);
                            batsman_to_score_a_fifty_in_the_match = 'Not available';
                            player_of_the_match = 'Not available';

                            console.log(hometeam);
                            console.log(visitorteam);

                            var batsmenlegth = category[i]['match'].inning[0].batsmanstats.player.length;

                            let j;
                            for (j = 0; j < batsmenlegth; j++) {
                                var total = category[i]['match'].inning[0].batsmanstats.player[j].s4;
                                firstiningfours += parseInt(total);
                                var total1 = category[i]['match'].inning[0].batsmanstats.player[j].s6;
                                firstiningsixes += parseInt(total1);
                                var scored = category[i]['match'].inning[0].batsmanstats.player[j].r;
                                if (scored >= 100) {
                                    hundred_scored_inmatch = 'yes';
                                }
                                else {
                                    if (scored >= 50) {
                                        fifty_scored_inmatch = 'yes';
                                        batsman_to_score_a_fifty_in_the_match = 'Not available';
                                        batsman_to_score_a_fifty_in_the_match = category[i]['match'].inning[0].batsmanstats.player[j].batsman;
                                    }
                                }
                            }

                            var secondiningsfourslenght = category[i]['match'].inning[1].batsmanstats.player.length;
                            let k;
                            for (k = 0; k < secondiningsfourslenght; k++) {
                                var total = category[i]['match'].inning[1].batsmanstats.player[k].s4;
                                secondiningfourstotal += parseInt(total);

                                var total1 = category[i]['match'].inning[1].batsmanstats.player[k].s6;
                                secondiningsixestotal += parseInt(total1);

                                var scored = category[i]['match'].inning[1].batsmanstats.player[k].r;
                                if (scored >= 100) {
                                    hundred_scored_inmatch = 'yes';
                                }
                                else {
                                    if (scored >= 50) {
                                        fifty_scored_inmatch = 'yes';
                                        batsman_to_score_a_fifty_in_the_match = 'Not available';

                                        batsman_to_score_a_fifty_in_the_match = category[i]['match'].inning[1].batsmanstats.player[k].batsman;

                                    }
                                }
                            }

                            total_match_sixes = firstiningsixes + secondiningsixestotal;
                            total_match_fours = firstiningfours + secondiningfourstotal;

                            if (k == secondiningsfourslenght) {
                                secondiningfourstotal = 0;
                                secondiningsixestotal = 0;
                            }

                            if (j == batsmenlegth) {
                                firstiningfours = 0;
                                firstiningsixes = 0;
                            }

                            if (category[i]['match'].localteam.winner == "true") {
                                won = hometeam;
                            }
                            else {
                                won = visitorteam;
                            }

                            first_innnings_score = category[i]['match'].inning[0].total.tot;
                            var home_total_runs_in_match = category[i]['match'].inning[0].total.tot;
                            var visotr_total_runs_in_match = category[i]['match'].inning[1].total.tot;

                            home_total_runs_in_match = home_total_runs_in_match.substring(0, home_total_runs_in_match.indexOf('('));
                            home_total_runs_in_match = parseInt(home_total_runs_in_match.trim());
                            visotr_total_runs_in_match = visotr_total_runs_in_match.substring(0, visotr_total_runs_in_match.indexOf('('));
                            visotr_total_runs_in_match = parseInt(visotr_total_runs_in_match.trim());
                            total_runs_in_match = home_total_runs_in_match + visotr_total_runs_in_match;
                            var matchid = category[i]['match'].id;
                            var matchdate = category[i]['match'].date;

                            console.log("goalid:" + goalid)
                            console.log("won by:" + won);
                            console.log("player_of_the_match:" + mom);
                            console.log("matchid:" + matchid);
                            console.log("matchdate:" + matchdate);
                            console.log("total_runs_in_match:" + total_runs_in_match);
                            console.log("first_innnings_score:" + first_innnings_score)
                            console.log("fifty_scored_inmatch:" + fifty_scored_inmatch);
                            console.log("total_match_sixes:" + total_match_sixes)
                            console.log("total_match_fours:" + total_match_fours);
                            console.log("matchtype:" + matchtype);
                            console.log("hometeam:" + hometeam);
                            console.log("visitorteam:" + visitorteam);
                            console.log("hundred_scored_inmatch:" + hundred_scored_inmatch);
                            console.log("batsman_to_score_a_fifty_in_the_match:" + batsman_to_score_a_fifty_in_the_match);

                            connection.query("INSERT INTO scoreext (goalid,matchid,hometeam, visitorteam,match_status,won,matchdate,matchtype,createdtime,updatedtime,total_runs_in_match,total_match_sixes,total_match_fours,1st_innnings_score,player_of_the_match,batsman_to_score_a_fifty_in_the_match,a_hundred_to_be_scored_in_the_match) VALUES('" + goalid + "','" + matchid + "','" + hometeam + "','" + visitorteam + "','" + staus + "','" + won + "','" + matchdate + "','" + matchtype + "','" + created + "','" + created + "','" + total_runs_in_match + "','" + total_match_sixes + "','" + total_match_fours + "','" + first_innnings_score + "','" + player_of_the_match + "','" + batsman_to_score_a_fifty_in_the_match + "','" + hundred_scored_inmatch + "');", (err, rows) => {
                                if (err) throw err;
                                console.log('The data from users table are: \n', rows.length);
                            });
                        }
                        else {
                            console.log("do nothing");
                        }
                    });
                }
                console.log(i);
            }
        })
        .catch(error => {
            console.error(error);
            res.status(400).send(error);
        });
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
            if (err) throw err;
            console.log('The data from users table are: \n', rows);
            res.status(200).send(JSON.stringify({ 'success': '1' }));
        });
    }
    catch (error) {
        console.error(error);
        res.status(400).send(error);
    }
});

//****  port  *********//
app.get("/global/leader", (req, res) => {
    const token = req.param('token');
    var userid = req.param('userid');
    console.log(userid)
    var results;

    try {
        connection.query("Select * FROM main_leaderboard ORDER BY rank ASC limit 0,10", (err, result, fields) => {
            if (err) throw err;
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
        connection.query("Select * FROM gameleaderboard where fid='" + fi + "' ORDER BY rank ASC limit 0,10", (err, result, fields) => {
            if (err) throw err;
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
