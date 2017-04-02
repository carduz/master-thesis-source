/**
 * Created by claudio on 08/12/16.
 */
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var redis = require('socket.io-redis');
var pg = require ('pg');
io.adapter(redis({ host: '192.168.3.111', port: 6379}));
const exec = require('child_process').exec;

Object.values = function(obj){
    "use strict";
    return Object.keys(obj).map(function(key) {
        return obj[key];
    });
};

var client = null;
pg.connect('postgres://test:test@192.168.3.110/test', function(err, clientR) {
    if(err) {
        console.error(err);
        return ;
        //TODO exit
    }
    client = clientR;
});

function callback(tableName) {
    return function (socket) {
        //console.log('connected');
        //say to the client that a new connection was enstablished
        socket.emit('status', 'New Connection');

        //vector of authorized channels for the client
        var authorizedChannels = [];


        authorizedChannels = ['testChannel'];
        //join to a channel
        socket.on('join', function (msg) {
            "use strict";
            //console.log(msg);
            socket.join(msg, ()=> {
                socket.emit('status', 'Join on channel: ' + msg);
                //TODO justify with CASUALLY consistency, is the trigger called after commit?
                //TODO NOTIFY interacts with SQL transactions in some important ways. Firstly, if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed
                //TODO how to justify using classical approach? another way is required, maybe a doub le check
                client.query('SELECT * from ' + tableName + ' where channel = $1 ', [msg], function (err, result) {
                    if (err) throw err;

                    result.rows.forEach(value=> {
                        socket.emit('insert', {old: {}, new: value, id: value.id});
                    });
                });
            });
        });

        //join to a channel
        socket.on('leave', function (msg) {
            "use strict";
            socket.leave(msg, ()=>socket.emit('status', 'Leave channel: ' + msg));
        });

        socket.on('add', (key, value)=> {
            //console.log('p',value.description);
            client.query('INSERT INTO ' + tableName + ' (id, name, description, channel) VALUES ($1, $2, $3, $4)', [key, value.name, value.description, value.channel], function (err, result) {
                if (err) throw err;
                //console.log('i',value.description);
            });
        });

        socket.on('put', (key, value)=> {
            client.query('SELECT * from ' + tableName + ' where id = $1', [key], function (err, result) {
                if (err) throw err;

                if (result.rows.length == 0 || Object.values(socket.rooms).indexOf(value.channel.toString()) == -1)
                    return socket.emit('delete', {id: key});

                if (Object.values(socket.rooms).indexOf(result.rows[0].channel.toString()) == -1 || result.rows[0].channel.toString() != value.channel.toString()) {
                    return socket.emit('put', {id: key, old: value, new: result.rows[0]});
                }
                client.query('UPDATE ' + tableName + ' SET name = $1,  description = $2, channel = $3 where id = $4', [value.name, value.description, value.channel, key], function (err, result) {
                    if (err) throw err;
                });

            });
        });

        socket.on('delete', (key)=> {
            client.query('SELECT * from ' + tableName + ' where id = $1 ', [key], function (err, result) {
                if (err) throw err;

                if (result.rows.length == 0) return;

                if (Object.values(socket.rooms).indexOf(result.rows[0].channel.toString()) == -1) {
                    return socket.emit('add', {id: key, new: result.rows[0]});
                }
                client.query('DELETE FROM ' + tableName + ' where id = $1', [key], function (err, result) {
                    if (err) throw err;
                });
            });
        })
    }
}
var tables = ['test', 'posts', 'likes', 'comments'];
tables.forEach(table=>io.of('/'+table).on('connection', callback(table)));


//start the server
http.listen(3000, function(){
    console.log('listening on *:3000');
});
