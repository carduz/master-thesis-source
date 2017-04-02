/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const ProcessLibrary = require('../../processManager/processLibrary');
const Gun = require('gun');
const config = require('../../config.json');

let processManager = new ProcessLibrary(process.stdin, process.stdout);

processManager.on('connect', (client)=>{
    let peers = [
        'http://192.168.3.116:8080/gun',
    ];

    let gun = Gun({
        peers: peers,
        file: __dirname+'/data/data-'+client.id+'.json'
    });


    client.on('write', data=>{
        gun.get(data.table).path(data.channel).path(Gun.text.random()).put(data.data);
        if(config.clientDebug)
            client.emit('debug', {type: 'write', data: data.data});
    });

    client.on('join', data=>{
        gun.get(data.table).path(data.channel).map().val(update=>{
            delete update._;
            client.emit('data', {table: data.table, channel:data.channel, data:update});
        });
    });

    client.on('close', ()=>{
        if(config.clientDebug)
            client.emit('debug', {id: client.id, status: 'closed'});
    });
});
