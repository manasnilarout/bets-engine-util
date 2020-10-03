const { createClient } = require('redis');
const { promisify } = require('util');

module.exports = class RedisDB {
    onSubscription;
    onEventTrigger;

    _connectionOptions;
    client;
    getAsync;
    setAsync;
    hsetAsync;
    hgetAsync;
    delAsync;
    _redisPublisher;
    _redisSubscriber;
    subscriber;

    get publisherClient() {
        this._redisPublisher = this._connectionOptions
            ? createClient(this._connectionOptions) : createClient();
        return this._redisPublisher;
    }

    get subscriberClient() {
        this._redisSubscriber = this._connectionOptions
            ? createClient(this._connectionOptions) : createClient();
        return this._redisSubscriber;
    }

    /**
     * 
     * @param {host?: string; port?: number; password?: string;} connectionOptions 
     * @param {*} onSubscriptionMethod 
     */
    constructor(connectionOptions, onSubscriptionMethod) {
        this.onSubscription = onSubscriptionMethod
            ? onSubscriptionMethod : this.onSubscriptionDefault;
        // Set options to a property
        this._connectionOptions = connectionOptions;
        // Set default subscriber client
        this.subscriber = this.subscriberClient;
    }

    async connect(opts) {
        return new Promise((resolve, reject) => {
            this._connectionOptions = opts;
            this.client = createClient(opts);

            const that = this;
            this.client.on('connect', () => {
                if (opts.password) {
                    that.client.auth(opts.password, () => {
                        that.initiateAllMethods();
                        resolve(that.client);
                    });
                    return;
                }

                that.initiateAllMethods();
                return resolve(that.client);
            }).on('error', (e) => {
                that.onError(e);
                reject(e);
            });
        });
    }

    /**
     * Method to get values from RedisDB
     * @param key It is either a string or an array of strings for which value needs be fetched.
     */
    async get(key) {
        try {
            if (typeof key === 'string') {
                return await this.getAsync(key);
            } else {
                const values = [];
                for (const keyField of key) {
                    values.push({
                        key: keyField,
                        value: await this.getAsync(keyField),
                    });
                }
                return values;
            }
        } catch (err) {
            this.onError(err);
            throw err;
        }
    }

    /**
     * Method to set a property in RedisDB
     * All the values that are stored inside redis are stringified
     * @param arg It is an object where key will be redis key and value can be anything
     */
    async set(key, value) {
        try {
            await this.setAsync(key, value);
        } catch (e) {
            this.onError(e);
            throw e;
        }
    }

    /**
     * Method to set key with some expiry time.
     * @param key redis key name
     * @param value redis value to be set for the key
     * @param duration duration for the key to be stored in redis
     */
    async setKeyWithTTL(key, value, duration) {
        try {
            await this.set(key, value);
            await this.setKeyExpiry(key, duration);
        } catch (err) {
            this.onError(err);
            throw err;
        }
    }

    /**
     * Method to get the redis key value and time to live period if expiry is set.
     * @param key redis key name
     */
    async getKeyWithTTL(key) {
        try {
            const value = await this.get(key);
            const timeToLive = await this.useRedisMethod('TTL', [key]);
            return { value, timeToLive };
        } catch (err) {
            this.onError(err);
            throw err;
        }
    }

    /**
     * Method to set time to live period in redis.
     * @param key redis key name
     * @param duration duration of the key to live in redis
     */
    async setKeyExpiry(key, duration = 15) {
        try {
            return await this.useRedisMethod('EXPIRE', [key, duration]);
        } catch (err) {
            this.onError(err);
            throw err;
        }
    }


    /**
     * Method to delete keys from RedisDB
     * @param arg Keys that needs to be removed, it can be a string or an array of strings
     */
    async del(arg) {
        try {
            if (Array.isArray(arg)) {
                // @ts-ignore
                return await this.delAsync(...arg);
            }
            return await this.delAsync(arg);
        } catch (e) {
            this.onError(e);
            throw e;
        }
    }

    /**
     * Method to disconnect redis connection
     */
    async disconnect() {
        return new Promise((resolve, reject) => {
            this.client.quit((err) => {
                if (err) {
                    this.onError(err);
                    reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Method to generalize all the functions provided by redisdb.
     * @param methodName Method name that needs to be performed on RedisDB
     * @param methodArguments Array of arguments that needs be passed to the method
     */
    async useRedisMethod(methodName, methodArguments) {
        try {
            const methodDef = promisify(this.client[methodName]).bind(this.client);
            const results = await methodDef(...methodArguments);
            return results;
        } catch (e) {
            this.onError(e);
            throw e;
        }
    }

    async subscribe(channel) {
        this.subscriber.subscribe(channel);
        await this.eventHandler('subscribe', this.onSubscription);
    }

    async eventHandler(event, cb) {
        this.subscriber.on(event, cb);
    }

    async onSubscriptionDefault(channel, message) {
        return new Promise((resolve) => {
            return resolve();
        });
    }

    initiateAllMethods() {
        this.getAsync = promisify(this.client.get).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
        this.hsetAsync = promisify(this.client.hset).bind(this.client);
        this.hgetAsync = promisify(this.client.hget).bind(this.client);
        this.delAsync = promisify(this.client.del).bind(this.client);
    }

    onError(err) {
        console.log('Redis error.');
        console.log(err);
    }
}
