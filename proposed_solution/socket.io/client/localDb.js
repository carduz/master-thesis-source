"use strict";
var uuidV4 = require('uuid/v4');
function timeoutPromise(cb, time){
    return new Promise((resolve, reject)=>{
        window.setTimeout(()=>{
            try{
                resolve(cb());
            }catch(e){
                reject(e);
            }
        }, time);
    });
}
class Database{
    constructor(client) {
        this._client = client;
        this._data = {};
        this._onChange = ()=>{};
        this._client.onDelete((key)=>this.onDeleteCb(key));
        this._client.onAdd((key, value)=>this.onAddPutCb(key, value));
        this._client.onPut((key, value)=>this.onAddPutCb(key, value));
        this._client.onConnectPromise.then(()=> {
            this._client.init();
        });
    }

    onDeleteCb(key){
        delete this._data[key];
        this._onChange(key, null); //null = deleted
    }

    onAddPutCb(key, value){
        this._data[key] = value;
        this._onChange(key, value);
    }

    onChange(cb){
        this._onChange = cb;
    }

    remoteCall(type, key, value){
        value = value  || {};
        let makeRequest = () => {
            return this._client.call(type, key, value)
                .then(()=> {
                })
                .catch(()=>timeoutPromise(makeRequest, 1000));
        };
        makeRequest();
    }

    add(value){
        let key = this.getId();
        value = JSON.parse(JSON.stringify(value)); //clone
        value.id = key;
        this._data[key] = value;
        this.remoteCall('add', key, value);
    }

    delete(key){
        delete this._data[key];
        this.remoteCall('delete', key);
    }

    put(key, value){
        value = JSON.parse(JSON.stringify(value)); //clone
        this._data[key] = value;
        this.remoteCall('put', key, value);
    }

    getId(){
        return uuidV4()
    }

    auth(psw){
        this.remoteCall('auth', psw);
    }

    join(channel){
        this.remoteCall('join', channel);
    }

    get data(){
        return this._data;
    }
}

//socketIO impelmentation
class Client{

    constructor(socket) {
        this._socket = socket;
        this._onAdd = ()=>{};
        this._onPut = ()=>{};
        this._onDelete = ()=>{};
        this._onConnectPromise = new Promise((resolve, reject)=>{
            this._socket.on('connect', ()=>{
                console.log('connected');
                resolve();
            });
        });
        this._socket.on('insert', (data)=>this._onAdd(data.id,data.new));
        this._socket.on('update', (data)=>this._onPut(data.id,data.new));
        this._socket.on('delete', (data)=>this._onDelete(data.id));
    }

    init(){
        this._socket.emit('init');
    }

    call(type, key, value){
        this._socket.emit(type, key, value);
        return Promise.resolve(); //TODO fix
    }

    onAdd(cb){
        this._onAdd = cb;
    }

    onPut(cb){
        this._onPut = cb;
    }

    onDelete(cb){
        this._onDelete = cb;
    }

    get onConnectPromise(){
        return this._onConnectPromise;
    }
}
