/**
 * Created by claudio on 27/03/17.
 */
"use strict";
var stream = require('stream');

module.exports.readStream = function getReadStream(cb, name) {
    name = name || '';
    let ws = new stream;
    ws.writable = true;
    ws.bytes = 0;

    ws.write = function (buf) {
        ws.bytes += buf.length;
        cb(buf);
    };

    ws.end = function (buf) {
        if (arguments.length) ws.write(buf);
        ws.writable = false;

    };
    return ws;
};

module.exports.storePromise = class {
    constructor() {
        this.fresh();
    }

    fresh(){
        this._promise = new Promise((resolve, reject)=>{
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    get promise(){
        return this._promise;
    }

    resolve(data){
        return this._resolve(data);
    }

    reject(data){
        return this._reject(data);
    }
};

module.exports.timer = class{
    constructor() {

    }

    start(){
        this._startTime = process.hrtime();
        return this;
    }

    time(){
        if(!this._startTime) return null;
        let diff = process.hrtime(this._startTime);
        return diff[0]*1000000000 + diff[1];
    }

    timeInSeconds(){
        let time = this.time();
        if(!time) return null;
        return time/1000000000;
    }
};

module.exports.timePromise = function(time){
    return new Promise(resolve=>setTimeout(resolve, time));
};
