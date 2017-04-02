/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const storePromise = require('./utils').storePromise;
let pools = require('./processManager/processesPoool');
const config = require('./config.json');

module.exports = class{
    constructor(name){
        this.name = name;
        this.process = pools(name).getInstance();
        this.initPromise = new storePromise();
        this.process.then(process=>{
            this.process = process;
            this.process.on('data', data=>{
                if(config.debug)
                    console.log(data);
                this._onDataReceived(data);
            });

            this.process.on('debug', data=>{
                console.log(data);
            });
            this.initPromise.resolve();
        });
        this._cbCounter = 0;
        this._onData = {};
    }

    _onDataReceived(data){
        this.callOnDataCbs(data);
    }

    callOnDataCbs(data){
        Object.keys(this._onData).forEach(key=>{
            try {
                this._onData[key](data);
            }catch(e){
                console.error(e);
            }
        });
    }

    onData(cb){
        let key = 'k'+this._cbCounter++;
        this._onData[key] = cb;
        return key;
    }

    offData(key){
        delete this._onData[key];
    }

    start(){
        //this.process.start();
        return this;
    }

    join(table, channel){
        return this.process.emit('join', {table: table, channel: channel});
    }

    write(table, channel, data){
        return this.process.emit('write', {table: table, channel: channel, data: data});
    }

    close(){
        this.process.close();
        return this;
    }
};
