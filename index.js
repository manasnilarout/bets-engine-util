'use strict'
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
            if (err) return handleError(err);
            return resolve({ results, fields });
        })
    });
};

const handleError = (err) => {
    console.log('There was an error.', err);
};

const getScores = async () => {
    const url = `http://www.goalserve.com/getfeed/${GOAL_SERVE.token}/cricket/livescore?json=1`;
    console.log(`Making API call to => ${url}`);
    const result = await (await fetch(url)).json();
    return await parseInProgressGame(result.scores.category);
};

const getBattingTeam = (match) => {
    let inning;
    const playersList = getTeamPlayerList(match);
    if (Array.isArray(match.inning)) {
        inning = match.inning[1];
    } else {
        inning = match.inning;
    }

    const batsManName = inning.batsmanstats.player[0].batsman;

    if (playersList[teamTypes.VISITOR_TEAM].indexOf(batsManName) > -1) {
        return match[teamTypes.VISITOR_TEAM].name;
    }

    return match[teamTypes.LOCAL_TEAM].name;
};

const getTeamPlayerList = (match) => {
    return {
        [teamTypes.VISITOR_TEAM]: match.lineups[teamTypes.VISITOR_TEAM].player.map(p => p.name),
        [teamTypes.LOCAL_TEAM]: match.lineups[teamTypes.LOCAL_TEAM].player.map(p => p.name),
    }
};

const parseInProgressGame = async (category) => {
    const gameRealTimeStats = [];

    if (Array.isArray(category)) {
        for (const cat of category) {
            if (cat.match.status !== 'In Progress') {
                continue;
            }

            gameRealTimeStats.push({
                goalId: cat.id,
                inProgress: cat.match.status === 'In Progress' ? true : false,
                matchId: cat.match.id,
                homeTeam: cat.match.localteam.name,
                visitorTeam: cat.match.visitorteam.name,
                matchType: cat.match.type,
                matchDate: new Date(cat.match.date.replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,4})/g, '$2/$1/$3')).toISOString(),
                lastOver: getLastOverScore(cat.match.commentaries.commentary).over,
                lastOverScore: getLastOverScore(cat.match.commentaries.commentary).runs,
                battingTeam: getBattingTeam(cat.match),
            });
        }
    } else {
        if (category.match.status !== 'In Progress') {
            return gameRealTimeStats;
        }

        gameRealTimeStats.push({
            goalId: category.id,
            inProgress: category.match.status === 'In Progress' ? true : false,
            matchId: category.match.id,
            homeTeam: category.match.localteam.name,
            visitorTeam: category.match.visitorteam.name,
            matchType: category.match.type,
            matchDate: new Date(category.match.date.replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,4})/g, '$2/$1/$3')).toISOString(),
            lastOver: getLastOverScore(category.match.commentaries.commentary).over,
            lastOverScore: getLastOverScore(category.match.commentaries.commentary).runs,
            battingTeam: getBattingTeam(category.match),
        });
    }

    return gameRealTimeStats;
};

const getLastOverScore = (commentaries) => {
    const finishedOver = commentaries.find(sc => sc.over_ended === 'True');
    return {
        over: parseInt(finishedOver.over) + 1,
        runs: finishedOver.runs
    };
};

const main = async () => {
    const scores = await getScores();
    const oldRecordCheckQuery = "SELECT * FROM `scoreext` WHERE goalid = ? AND hometeam = ? AND visitorteam = ? AND matchdate = ? AND batting_team = ? AND over = ?;";
    const insertNewRecordQuey = "INSERT INTO `scoreext` (`goalid`, `matchid`, `hometeam`, `visitorteam`, `match_status`, `matchdate`, `matchtype`, `over`, `runs`, `createdtime`, `updatedtime`, `batting_team`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"


    for (const score of scores) {
        const oldRecord = await runQuery(oldRecordCheckQuery, [
            score.goalId,
            score.homeTeam,
            score.visitorTeam,
            score.matchDate,
            score.battingTeam,
            score.lastOver
        ]);

        if (!oldRecord.results.length) {
            const newRecord = await runQuery(insertNewRecordQuey, [
                score.goalId,
                score.matchId,
                score.homeTeam,
                score.visitorTeam,
                score.inProgress ? 'In progress' : 'Finished',
                score.matchDate,
                score.matchType,
                score.lastOver,
                score.lastOverScore,
                new Date().toISOString(),
                new Date().toISOString(),
                score.battingTeam
            ]);
            console.log('Updated new scores.');
        }

        console.log(`Continuing over => ${score.lastOver}`);
    }
    return;
};

const delay = t => new Promise(resolve => setTimeout(resolve, t));

const handler = async (event, context) => {
    await connectToDb();
    await main();
    process.exit(0);
};

const loop = async () => {
    await connectToDb();
    while (true) {
        await main();
        console.log('Waiting');
        await delay(5000);
    }
};
handler();
// module.exports = { handler };