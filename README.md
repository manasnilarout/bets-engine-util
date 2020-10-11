# bets-engine-util
Utility functions for BETS ENGINE.
1. **server.js** : Has the server code that holds API.
    - Run it with this command: `node server`
2. **goalServeScoreCollection.js** : Has the code that collects scores from goal server and puts in _redis_.
    - Run it with this command: `node goalServeScoreCollection`
3. **finalScores.js** : Contains code to collect final scores once match finishes.
    - Run it with this command: `node finalScores`
4. **periodic-cleanup.py** : Contains code to clean database records older than a month.
    - Run it with this command: `python3 periodic-cleanup.py`
5. **collect-squads.go** : Contains code to collect squads information.
    - Run it with this command: `go run collect-squads.go`