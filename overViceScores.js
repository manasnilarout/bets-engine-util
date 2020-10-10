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
        inning = match.inning.find(i => i.inningnum === '2');
    } else {
        inning = match.inning;
    }

    const batsManName = inning.batsmanstats.player[0].batsman;

    if (playersList[teamTypes.VISITOR_TEAM].indexOf(batsManName) > -1) {
        return match[teamTypes.VISITOR_TEAM].name;
    }

    return match[teamTypes.LOCAL_TEAM].name;
};

const getOverWicket = (match) => {
    let lastWicket = [];

    const over = getLastOverScore(match.commentaries.commentary).over;

    if (match.wickets && match.wickets.wicket) {
        if (Array.isArray(match.wickets.wicket)) {
            lastWicket = match.wickets.wicket.filter(w => over === parseInt(w.overs))
        } else if (over === parseInt(match.wickets.wicket.overs)) {
            lastWicket.push(match.wickets.wicket);
        }
    }

    return lastWicket.length;
};

const getTeamPlayerList = (match) => {
    return {
        [teamTypes.VISITOR_TEAM]: match.lineups[teamTypes.VISITOR_TEAM].player.map(p => p.name),
        [teamTypes.LOCAL_TEAM]: match.lineups[teamTypes.LOCAL_TEAM].player.map(p => p.name),
    }
};

const getCurrentInningScore = (match) => {
    let inning;
    let firstInning;

    if (Array.isArray(match.inning)) {
        inning = match.inning.find(i => i.inningnum === '2');
        firstInning = match.inning.find(i => i.inningnum === '1');
    } else {
        inning = match.inning;
    }

    const currentBatsMan = inning.batsmanstats.player.filter(bm => bm.status === 'not out');
    const currentBowler = Array.isArray(inning.bowlers.player) ? inning.bowlers.player.find(bo => bo.ball === 'True') : inning.bowlers.player;

    const currentInningScores = Object.assign(getRefinedInningStats(inning), {
        batsmen: currentBatsMan,
        bowler: currentBowler
    });

    const latestScore = match.commentaries && match.commentaries.commentary[0] || undefined;

    const currentOverStats = latestScore ? {
        over: parseFloat(latestScore.over),
        overEnded: latestScore.over_ended === 'True' ? true : false,
        ballPost: latestScore.post,
        runs: latestScore.runs
    } : undefined;

    return {
        firstinnings: firstInning ? getRefinedInningStats(firstInning) : currentInningScores,
        secondinnnings: firstInning ? currentInningScores : {},
        currentOverStats,
        post: match.comment.post,
    };
};

const getRefinedInningStats = (inning) => {
    return {
        inningNumber: Number(inning.inningnum),
        team: inning.name.replace(/\s\d\sINN/g, ''),
        score: inning.total.tot,
        wickets: inning.total.wickets,
        overallScores: inning.total
    }
};

const parseInProgressGame = async (category) => {
    const gameRealTimeStats = [];

    if (Array.isArray(category)) {
        for (const cat of category) {
            if (cat.match.status !== 'In Progress') {
                continue;
            }

            if (!cat.match.commentaries) {
                continue;
            }

            gameRealTimeStats.push({
                goalId: cat.id,
                inProgress: cat.match.status === 'In Progress' ? true : false,
                matchId: cat.match.id,
                homeTeam: cat.match.localteam.name,
                visitorTeam: cat.match.visitorteam.name,
                matchType: cat.match.type,
                matchDate: new Date(cat.match.date.replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,4})/g, '$2/$1/$3')).toISOString().split('T')[0],
                lastOver: cat.match.commentaries ? getLastOverScore(cat.match.commentaries.commentary).over : 0,
                lastOverScore: cat.match.commentaries ? getLastOverScore(cat.match.commentaries.commentary).runs : 0,
                battingTeam: getBattingTeam(cat.match),
                moreStats: getCurrentInningScore(cat.match),
                wicketsCount: getOverWicket(cat.match),
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
            matchDate: new Date(category.match.date.replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,4})/g, '$2/$1/$3')).toISOString().split('T')[0],
            lastOver: getLastOverScore(category.match.commentaries.commentary).over,
            lastOverScore: getLastOverScore(category.match.commentaries.commentary).runs,
            battingTeam: getBattingTeam(category.match),
            scores: getCurrentInningScore(category.match),
            wicketsCount: getOverWicket(category.match),
        });
    }

    return gameRealTimeStats;
};

const getLastOverScore = (commentaries) => {
    if (!commentaries) {
        return {};
    }

    const finishedOver = commentaries.find(sc => sc.over_ended === 'True');

    if (!finishedOver) {
        return {};
    }

    return {
        over: parseInt(finishedOver.over) + 1,
        runs: finishedOver.runs
    };
};

const main = async () => {
    const scores = await getScores();
    const oldRecordCheckQuery = "SELECT * FROM `scoreext` WHERE goalid = ? AND hometeam = ? AND visitorteam = ? AND matchdate = ? AND batting_team = ? AND `over` = ?;";
    const insertNewRecordQuey = "INSERT INTO `scoreext` (`goalid`, `matchid`, `hometeam`, `visitorteam`, `match_status`, `matchdate`, `matchtype`, `over`, `runs`, `batting_team`, `over_wicket`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"


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
                score.battingTeam,
                score.wicketsCount,
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
// module.exports = { handler, parseInProgressGame };