/**
 * Created by claudio on 28/03/17.
 */
"use strict";
const readStream = require('../utils').readStream;

class Client{

    constructor(manager, id) {
        this.manager = manager;
        this.id = id;
        this._listeners = {};
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

    _close(){
        if(this._listeners['close']) this._listeners['close']();
        this._listeners = {};
        this.closed = true;
    }
}

module.exports = class {
    constructor(input, output){
        this._input = input;
        this._output = output;
        this._listeners = {};
        this._clients = {};
        this._input.pipe(readStream((data)=>{
            data.toString().split('\n').forEach((data)=>{
                try {
                    data = JSON.parse(data);
                }catch(e){
                    return ; //it is not JSON
                }
                let event = data.event || 'none';
                let id = data.id;
                let content = data.content || {};
                switch(event){
                    case 'connect':
                        let cb = this._listeners['connect'];
                        if(!cb || !id) return ;
                        this._clients['k'+id] = new Client(this, id);
                        this._write(id, {status:'OK'}, 'connect');
                        cb(this._clients['k'+id]);
                        break;
                    case 'send': {
                        if (!id) return;
                        let client = this._clients['k' + id];
                        if (!client) return;
                        client._receive(content);
                        break;
                    }
                    case 'close': {
                        if (!id) return;
                        let client = this._clients['k' + id];
                        if (!client) return;
                        client._close();
                        break;
                    }
                    default:
                        //console.log(event);
                        break;
                }
            });
        }));
    }

    _write(id, content, event){
        event = event || 'send';
        this._output.write(JSON.stringify({content: content, id: id, event: event})+'\n');
    }

    on(event, handler){
        this._listeners[event] = handler;
        return this;
    }

    off(event){
        delete this._listeners[event];
        return this;
    }
};
