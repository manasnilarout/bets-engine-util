'use strict'

const { REDIS_OPTIONS, GOAL_SERVE } = require('./env');
const RedisDB = require('./util/redis.util');
const { makeApiCall, delay } = require('./util/util');
const { parseInProgressGame } = require('./overViceScores');

const redis = new RedisDB(REDIS_OPTIONS);

const collectAndParseScores = async () => {
    try {
        const goalServeApi = `http://www.goalserve.com/getfeed/${GOAL_SERVE.token}/cricket/livescore?json=1`;
        const results = await makeApiCall(goalServeApi);
        const scores = await parseInProgressGame(results.scores.category);
        redis.setKeyWithTTL('goalServeLive', JSON.stringify(scores), 60 * 60);
    } catch (err) {
        console.log('There was an error while collecting and storing LiveScore.');
        console.error(err);
    }
};

const main = async () => {
    await redis.connect(REDIS_OPTIONS);
    await collectAndParseScores();
};

const loop = async () => {
    while (true) {
        await main();
        console.log('Waiting');
        await delay(5000);
    }
};

loop();