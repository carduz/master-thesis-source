/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const ProcessLibrary = require('../../processManager/processLibrary');
const IOClient = require('socket.io-client');
const LocalDatabase = require('./localDb');
const config = require('../../config.json');

let processManager = new ProcessLibrary(process.stdin, process.stdout);

processManager.on('connect', (client)=>{
    let clients = {};
    let ioClients = [];
    let callbacks = {};
    let getClient = (table)=>{
        if(!clients[table]){
            let ioClient = IOClient('http://192.168.3.116:3000/'+table);
            ioClients.push(ioClient);
            clients[table] = new LocalDatabase.Database(new LocalDatabase.Client(ioClient));
        }
        return clients[table]
    };
    let setCallback = (table, channel, cb)=>{
        if(!callbacks[table]) {
            callbacks[table] = {};
            getClient(table).onChange((key, value)=>{
                if(!value) return ; //delete
                let channel = value.channel;
                let cb = callbacks[table][channel];
                if(!channel || !cb)
                    return ;
                cb(key, value);
            });
        }
        callbacks[table][channel] = cb;
    };

    client.on('write', data=>{
        let db = getClient(data.table);
        db.join(data.channel);
        data.data.channel = data.channel;
        db.add(data.data);
        if(config.clientDebug)
            client.emit('debug', {type: 'write', data: data.data});
    });

    client.on('join', data=>{
        let db = getClient(data.table);
        db.join(data.channel);
        if(config.clientDebug)
            client.emit('debug', {type: 'join', data: data.channel});
        setCallback(data.table, data.channel, (key, value)=>{
            client.emit('data', {table: data.table, channel:data.channel, data:value});
        });
    });

    client.on('close', ()=>{
        ioClients.forEach(ioClient=>ioClient.close());
        callbacks = {};
        client = {};
        if(config.clientDebug)
            client.emit('debug', {id: client.id, status: 'closed'});
    });
});
