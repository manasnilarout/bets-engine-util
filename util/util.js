const fetch = require('node-fetch');

const makeApiCall = async (url, options = {}, json = true) => {
    try {
        const res = await fetch(url, options);

        if (json) {
            return await res.json();
        }

        return await res.text();
    } catch (err) {
        console.log('There was an error while making API call.');
        return err;
    }
};

const delay = t => new Promise(resolve => setTimeout(resolve, t));

module.exports = { makeApiCall, delay };