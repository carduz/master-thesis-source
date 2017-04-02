/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const ProcessLibrary = require('../../processManager/processLibrary');
const Client = require('./client');
const config = require('../../config.json');

let processManager = new ProcessLibrary(process.stdin, process.stdout);

Object.values = function(obj){
    "use strict";
    return Object.keys(obj).map(function(key) {
        return obj[key];
    });
};

processManager.on('connect', (client)=>{
    let clients = {};
    let callbacks = {};

    let getClient = (table)=>{
        if(!clients[table]){
            let client = new Client(table);
            clients[table] = client;
            callbacks[table] = {};
            client.onData((change) => {
                change.forEach(doc=>{
                    if(!doc.doc) return ;
                    doc = doc.doc;
                    //console.log(doc);
                    let channel = doc.channel;
                    let cb = callbacks[table][channel];
                    if(!channel || !cb)
                        return ;
                    cb(doc);
                });
            })
        }
        return clients[table];
    };
    let setCallback = (table, channel, cb)=>{
        callbacks[table][channel] = cb;
    };

    client.on('write', data=>{
        let db = getClient(data.table);
        data.data.channel = data.channel;
        db.write(data.data);
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
        Object.values(clients).forEach(db=>db.close());
        callbacks = {};
        clients = {};
        if(config.clientDebug)
            client.emit('debug', {id: client.id, status: 'closed'});
    });
});
