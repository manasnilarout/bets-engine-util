# bets-engine-util
Utility functions for BETS ENGINE.
1. **server.js** : Has the server code that holds API.
2. **goalServeScoreCollection.js** : Has the code that collects scores from goal server and puts in _redis_.
3. **finalScores.js** : Contains code to collect final scores once match finishes.
4. **periodic-cleanup.py** : Contains code to clean database records older than a month.