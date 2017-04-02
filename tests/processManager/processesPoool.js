/**
 * Created by claudio on 28/03/17.
 */
"use strict";
const config = require('../config.json');
const Manager = require('./processManager');

class Pool{
    constructor(name){
        this.name = name;
        this.managers = [];
    }

    get length(){
        return this.managers.length;
    }

    getInstance(){
        let name = __dirname+'/../clients/'+this.name+'/index.js';
        let manager = this.managers[this.managers.length-1];
        if(!this.length || manager.length>=config.clientsPerProcess) {
            manager = new Manager(name, this.length+1);
            this.managers.push(manager);
        }
        return manager.getInstance();
    }
};

let pools = {};
module.exports = function getPool(name){
    if(!pools[name])
        pools[name] = new Pool(name);
    return pools[name]
};