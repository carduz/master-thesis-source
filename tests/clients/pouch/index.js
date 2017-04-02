/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const ProcessLibrary = require('../../processManager/processLibrary');
const PouchDB = require('pouchdb');
const config = require('../../config.json');
var uuidV4 = require('uuid/v4');

let processManager = new ProcessLibrary(process.stdin, process.stdout);

Object.values = function(obj){
    "use strict";
    return Object.keys(obj).map(function(key) {
        return obj[key];
    });
};

processManager.on('connect', (client)=>{

    let locals = {};
    let remotes = {};
    let callbacks = {};

    let getClient = (table)=>{
        if(!locals[table]){
            let localDB = new PouchDB(__dirname+'/data/data-'+client.id+'-'+table); //TODO add table
            let remoteDB = new PouchDB('http://192.168.3.35/'+table); //localhost:5984 //192.168.3.35
            locals[table] = localDB;
            remotes[table] = remoteDB;
            callbacks[table] = {};
            //https://pouchdb.com/2015/04/05/filtered-replication.html
            localDB.sync(remoteDB, {
                live: true
            }).on('change',  (change) => {
                change.change.docs.forEach(doc=>{
                    let channel = doc.channel;
                    let cb = callbacks[table][channel];
                    if(!channel || !cb)
                        return ;
                    cb(doc);
                });
            })
        }
        return {local: locals[table], remote: remotes[table]};
    };
    let setCallback = (table, channel, cb)=>{
        callbacks[table][channel] = cb;
    };

    client.on('write', data=>{
        let db = getClient(data.table);
        data.data._id = uuidV4();
        data.data.channel = data.channel;
        db.local.put(data.data);
        if(config.clientDebug)
            client.emit('debug', {type: 'write', data: data.data});
    });

    client.on('join', data=>{
        let db = getClient(data.table); //just to set main cb
        setCallback(data.table, data.channel, (value)=>{
            client.emit('data', {table: data.table, channel:data.channel, data:value});
        });
    });

    client.on('close', ()=>{
        Object.values(locals).forEach(db=>db.close());
        Object.values(remotes).forEach(db=>db.close());
        callbacks = {};
        locals = {};
        remotes = {};
        if(config.clientDebug)
            client.emit('debug', {id: client.id, status: 'closed'});
    });
});
