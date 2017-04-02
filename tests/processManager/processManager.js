/**
 * Created by claudio on 28/03/17.
 */
"use strict";
const ProcessLauncher = require('./processLauncher');
const StorePromise = require('../utils').storePromise;
class Instance{
    constructor(manager, id) {
        this.manager = manager;
        this.id = id || 0;
        this._listeners = {};
        this._loadedPromise = new StorePromise();
        this.closed = false;
    }

    on(event, handler){
        this._listeners[event] = handler;
        return this;
    }

    off(event){
        delete this._listeners[event];
        return this;
    }

    close(){
        this.manager._close(this.id);
        //this._listeners = {}; //remove listeners
        this.closed = true;
    }

    emit(event, content){
        this.manager._write(this.id, {event: event, content: content});
    }

    _receive(data){
        let event = data.event;
        let content = data.content;
        if(!event) return;
        let cb = this._listeners[event];
        if(!cb) return;
        cb(content);
    }
}

module.exports = class{
    constructor(name, id){
        this.id = id;
        this.programm = new ProcessLauncher(name);
        this.programm.start();
        this._instances = {};
        this.programm.onData((data)=>{
            let event = data.event || 'none';
            let id = data.id;
            let content = data.content || {};
            switch(event){
                case 'connect': {
                    if (!id) return;
                    let instance = this._instances['k' + id];
                    if (!instance) return;
                    instance._loadedPromise.resolve(instance);
                    break;
                }
                case 'send': {
                    if (!id) return;
                    let instance = this._instances['k' + id];
                    if (!instance) return;
                    instance._receive(content);
                    break;
                }
                default:
            }
        });
    }

    get length(){
        return Object.keys(this._instances).length;
    }

    getInstance(){
        let id = this.id+'-'+(this.length+1);
        this._instances['k'+id] = new Instance(this, id);
        this._write(id, {status:'OK'}, 'connect');
        return this._instances['k'+id]._loadedPromise.promise;
    }

    _write(id, content, event){
        event = event || 'send';
        this.programm.write({content: content, id: id, event: event});
        return this;
    }

    _close(id){
        this._write(id, {status: 'OK'}, 'close');
        //we do not remove it to keep consistency in the array;
        return this;
    }
};
