/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const spawn = require('child_process').spawn;
const readStream = require('../utils').readStream;
process.stderr.setMaxListeners(0);

module.exports = class{
    constructor(name, programArguments){
        this.name = name;
        this.programArguments = programArguments || [];
        this._onData = function(){};
    }

    start(){
        this.program = spawn('node', [this.name].concat(this.programArguments));
        this.program.stderr.pipe(process.stderr);
        this.program.stdout.pipe(readStream(data=>{
            data.toString().split('\n').forEach(data=>{
                //console.log(data);
                try {
                    this._onData(JSON.parse(data));
                }catch(e){
                    if(data.trim())
                        console.log(data);
                    return ;//this._onData(data); //it is not JSON
                }
            });
        }, this.name));
        return this;
    }

    write(data){
        if(this.program != null)
            return new Promise((resolve, reject)=>{
                this.program.stdin.write(JSON.stringify(data)+'\n', (err)=>{
                    if(err) return reject(err);
                    return resolve();
                });
            });
        return Promise.resolve();
    }

    onData(cb){
        this._onData = cb;
        return this;
    }

    kill(){
        if(this.program != null) {
            this.program.kill('SIGHUP');
        }
    }

};
