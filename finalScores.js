'use strict';

const { createConnection } = require('mysql');
const { DB_OPTIONS, GOAL_SERVE } = require('./env');
const fetch = require('node-fetch');

let conn;
const teamTypes = {
    VISITOR_TEAM: 'visitorteam',
    LOCAL_TEAM: 'localteam',
};

const connectToDb = async () => {
    return new Promise((resolve, reject) => {
        conn = createConnection(DB_OPTIONS);
        conn.connect((err) => {
            if (err) return reject(err);
            return resolve();
        });
    });
};

const runQuery = async (sql, args = []) => {
    return new Promise((resolve, reject) => {
        conn.query(sql, args, (err, results, fields) => {
            if (err) return reject(err);
            return resolve({ results, fields });
        });
    });
};

const getFinalResults = async () => {
    const url = `http://www.goalserve.com/getfeed/${GOAL_SERVE.token}/cricket/livescore?json=1`;
    console.log(`Making API call to => ${url}`);
    const result = await (await fetch(url)).json();
    return await parseFinishedGames(result.scores.category);
};

const getMatchResults = (category) => {
    const homeTeamScore = category.match[teamTypes.LOCAL_TEAM].totalscore.split('/')[0];
    const visitorTeamScore = category.match[teamTypes.VISITOR_TEAM].totalscore.split('/')[0];
    const homeTeamWickets = category.match[teamTypes.LOCAL_TEAM].totalscore.split('/')[1] || 10;
    const visitorTeamWickets = category.match[teamTypes.VISITOR_TEAM].totalscore.split('/')[1] || 10;
    const totalMatchRuns = Number(homeTeamScore) + Number(visitorTeamScore);
    const homeTeam = category.match[teamTypes.LOCAL_TEAM].name;
    const visitorTeam = category.match[teamTypes.VISITOR_TEAM].name;
    const toss = (category.match.matchinfo.info.find(inf => inf.name === 'Toss')).value.split(',')[0].trim();
    let homeTeamSixes = 0;
    let visitorTeamSixes = 0;
    let homeTeamFours = 0;
    let visitorTeamFours = 0;
    let firstInningScore = 0;
    let secondInningScore = 0;
    let playerOfTheMatch = category.match.matchinfo.info[1].value;
    let batsManToScoreFifties = '';
    const runsAtFirstWicketFall = 0;
    const highest1st6OverScore = 0;
    let hundredsScoredInGame = '';
    const firstWicketMethod = '';
    let highestOpeningPartnership = 0;
    const toGoToSuperOver = '';
    let mostRunOuts = '';
    let playerToHitMostSixes = '';
    let highestSixes = 0;
    const won = Number(homeTeamScore) > Number(visitorTeamScore) ? homeTeam : visitorTeam;

    const runOuts = {
        [teamTypes.LOCAL_TEAM]: 0,
        [teamTypes.VISITOR_TEAM]: 0,
    };

    const partnership = {
        [teamTypes.LOCAL_TEAM]: 0,
        [teamTypes.VISITOR_TEAM]: 0,
    };

    category.match.inning.forEach(inn => {
        const innTeam = inn.team;

        if (Number(inn.inningnum) === 1) {
            firstInningScore = inn.total.tot.match(/\d+/g)[0];
        } else {
            secondInningScore = inn.total.tot.match(/\d+/g)[0];
        }

        inn.batsmanstats.player.forEach((p, i) => {
            if (innTeam === teamTypes.LOCAL_TEAM) {
                homeTeamSixes += Number(p.s6);
                homeTeamFours += Number(p.s4);

                if (p.status.includes('run out')) {
                    ++runOuts[teamTypes.LOCAL_TEAM];
                }

                if (i < 2) {
                    partnership[teamTypes.LOCAL_TEAM] += Number(p.r);
                }
            } else {
                visitorTeamSixes += Number(p.s6);
                visitorTeamFours += Number(p.s4);

                if (p.status.includes('run out')) {
                    ++runOuts[teamTypes.VISITOR_TEAM];
                }

                if (i < 2) {
                    partnership[teamTypes.VISITOR_TEAM] += Number(p.r);
                }
            }

            // Get century and half centuries
            if (p.r > 100) {
                hundredsScoredInGame += hundredsScoredInGame ? ` | ${p.batsman} : ${p.r}` : `${p.batsman} : ${p.r}`;
            } else if (p.r > 50) {
                batsManToScoreFifties += batsManToScoreFifties ? ` | ${p.batsman} : ${p.r}` : `${p.batsman} : ${p.r}`;
            }

            // Get highest sixes
            if (Number(p.s6) > highestSixes) {
                highestSixes = Number(p.s6);
                playerToHitMostSixes = p.batsman;
            }
        });
    });

    if (partnership[teamTypes.LOCAL_TEAM] > partnership[teamTypes.VISITOR_TEAM]) {
        highestOpeningPartnership = partnership[teamTypes.LOCAL_TEAM];
    } else {
        highestOpeningPartnership = partnership[teamTypes.VISITOR_TEAM];
    }

    if (runOuts[teamTypes.LOCAL_TEAM] > runOuts[teamTypes.VISITOR_TEAM]) {
        mostRunOuts = `${homeTeam} : ${runOuts[teamTypes.LOCAL_TEAM]}`;
    } else if (runOuts[teamTypes.LOCAL_TEAM] === runOuts[teamTypes.VISITOR_TEAM]) {
        mostRunOuts = `${homeTeam} : ${runOuts[teamTypes.LOCAL_TEAM]} | ${visitorTeam} : ${runOuts[teamTypes.VISITOR_TEAM]}`;
    } else {
        mostRunOuts = `${visitorTeam} : ${runOuts[teamTypes.VISITOR_TEAM]}`;
    }

    return {
        goalId: category.id,
        matchId: category.match.id,
        matchType: category.match.type + ' - ' + category.name,
        matchDate: new Date(category.match.date.replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,4})/g, '$2/$1/$3')).toISOString().split('T')[0],
        homeTeamScore,
        homeTeam,
        won,
        visitorTeamScore,
        visitorTeam,
        homeTeamWickets,
        visitorTeamWickets,
        totalMatchRuns,
        homeTeamSixes,
        visitorTeamSixes,
        totalSixes: homeTeamSixes + visitorTeamSixes,
        homeTeamFours,
        visitorTeamFours,
        firstInningScore,
        secondInningScore,
        playerOfTheMatch,
        batsManToScoreFifties,
        playerToHitMostSixes,
        runsAtFirstWicketFall,
        highest1st6OverScore,
        hundredsScoredInGame,
        firstWicketMethod,
        highestOpeningPartnership,
        toGoToSuperOver,
        mostRunOuts,
        toss,
    };
};

const parseFinishedGames = async (category) => {
    const gameResults = [];

    if (Array.isArray(category)) {
        for (const cat of category) {
            if (cat.match.status !== 'Finished') continue;
            const result = getMatchResults(cat);
            gameResults.push(result);
        }
    } else if (category.match.status === 'Finished') {
        const result = getMatchResults(category);
        gameResults.push(result);
    }

    return gameResults;
};

const getHighestSixOverScore = (records, localTeam, visitorTeam) => {
    const scores = {
        [localTeam]: {},
        [visitorTeam]: {},
    };

    records.forEach(r => {
        if (!Number(r.over)) return;
        scores[r.batting_team][Number(r.over)] = Number(r.runs);
    });

    scores[localTeam].total = Object.values(scores[localTeam]).reduce((a, b) => a + b, 0);
    scores[visitorTeam].total = Object.values(scores[visitorTeam]).reduce((a, b) => a + b, 0);

    if (scores[localTeam].total > scores[visitorTeam].total) {
        return `${localTeam} : ${scores[localTeam].total}`;
    } else if (scores[localTeam].total > scores[visitorTeam].total) {
        return `${localTeam} : ${scores[localTeam].total} | ${visitorTeam} : ${scores[visitorTeam].total}`;
    }

    return `${visitorTeam} : ${scores[visitorTeam].total}`;
};

const main = async () => {
    await connectToDb();
    const results = await getFinalResults();

    const oldRecordCheckQuery = "SELECT * FROM `scoreext` WHERE goalid = ? AND hometeam = ? AND visitorteam = ? AND matchdate = ? AND match_status = ?;";
    const insertFinalResult = 'INSERT INTO `scoreext` ( `goalid`, `matchid`, `hometeam`, `visitorteam`, `match_status`, `matchdate`, `matchtype`, `won`, `hometeam_score`, `visitorteam_score`, `hometeam_wickets`, `visitorteam_wickets`, `total_runs_in_match `, `top_team_bowler`, `total_match_sixes`, `hometeam_total_match_sixes `, `visitorteam_total_match_sixes `, `hometotal_match_fours`, `visitortotal_match_fours`, `1st_innings_score`, `2nd_innings_score`, `player_of_the_match`, `batsman_to_score_a_fifty_in_the_match `, `player_to_score_most_sixes  `, `runs_at_fall_of_1st_wicket`, `team_to_make_highest_1st_6_overs_score`, `a_hundred_to_be_scored_in_the_match`, `1st_wicket_method`, `highest_opening_partnership`, `to_go_to_super_over`, `most_run_outs`, `toss_winning_team`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
    const first6OverScores = `SELECT * FROM cricketa_1cricket.scoreext q WHERE hometeam = ? AND visitorteam = ? AND matchdate = ? AND \`over\` <= 6;`;
    const updatePlayerOfTheMatch = "UPDATE `cricketa_1cricket`.`scoreext` SET `player_of_the_match` = ? WHERE (`id` = ?);";

    for (const res of results) {
        const oldRecords = await runQuery(oldRecordCheckQuery, [
            res.goalId,
            res.homeTeam,
            res.visitorTeam,
            res.matchDate.split('T')[0],
            'Finished',
        ]);

        const resultRecord = oldRecords.results[0];

        if (!resultRecord) {
            const sixOverScores = await runQuery(first6OverScores, [res.homeTeam, res.visitorTeam, res.matchDate.split('T')[0]]);

            const highest6OverScore = getHighestSixOverScore(sixOverScores.results, res.homeTeam, res.visitorTeam);

            await runQuery(insertFinalResult, [
                res.goalId,
                res.matchId,
                res.homeTeam,
                res.visitorTeam,
                'Finished',
                res.matchDate,
                res.matchType,
                res.won,
                res.homeTeamScore,
                res.visitorTeamScore,
                res.homeTeamWickets,
                res.visitorTeamWickets,
                res.totalMatchRuns,
                '-',
                res.totalSixes,
                res.homeTeamSixes,
                res.visitorTeamSixes,
                res.homeTeamFours,
                res.visitorTeamFours,
                res.firstInningScore,
                res.secondInningScore,
                res.playerOfTheMatch,
                res.batsManToScoreFifties,
                res.playerToHitMostSixes,
                res.runsAtFirstWicketFall,
                highest6OverScore,
                res.hundredsScoredInGame,
                res.firstWicketMethod,
                res.highestOpeningPartnership,
                res.toGoToSuperOver,
                res.mostRunOuts,
                res.toss,
            ]);

            console.log('Updated new scores.');
        }

        if (resultRecord && !resultRecord.player_of_the_match && res.playerOfTheMatch) {
            await runQuery(updatePlayerOfTheMatch, [res.playerOfTheMatch, resultRecord.id]);
            console.log('Updated player of the match details.');
        }
    }

    process.exit(0);
};
// main();
module.exports = { main };