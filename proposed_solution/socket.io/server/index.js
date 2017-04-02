var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var redis = require('socket.io-redis');
var pg = require ('pg');
io.adapter(redis({ host: '192.168.3.111', port: 6379}));

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
        process.exit(1);
    }
    client = clientR;
});

var tableName = 'test';
io.of('/'+tableName).on('connection', function(socket){
    //say to the client that a new connection was enstablished
    socket.emit('status','New Connection');

    //vector of authorized channels for the client
    var authorizedChannels = [];

    //simple authentication
    socket.on('auth', function(msg){
        "use strict";
        if(msg == 'psw1') {
            authorizedChannels = [1, 2, 3, 4, 5];
            socket.emit('status','Auth ok');
        }else if(msg == 'psw2') {
            authorizedChannels = [6, 7, 8, 9, 10];
            socket.emit('status','Auth ok');
        }else
            socket.emit('status','No auth');
    });

    //console.log('rooms',socket.rooms);
    //join to a channel
    socket.on('join', function(msg){
        "use strict";
        if(authorizedChannels.indexOf(parseInt(msg))>=0){
            socket.join(msg, ()=>{
                socket.emit('status','Join on channel: '+ msg);
                client.query('SELECT * from '+tableName+' where owner = $1 ', [msg], function (err, result) {
                    if (err) throw err;

                    result.rows.forEach(value=>{
                        socket.emit('insert',{old:{}, new:value, id: value.id});
                    });
                });
            });
        }else
            socket.emit('status','Forbidden channel: '+ msg);
    });

    //leave a channel
    socket.on('leave', function(msg){
        "use strict";
        socket.leave(msg, ()=>socket.emit('status','Leave channel: '+ msg));
    });

    socket.on('add', (key, value)=>{
        if (Object.values(socket.rooms).indexOf(value.owner.toString()) == -1) {
            return socket.emit('delete', {id: key});
        }
        client.query('INSERT INTO ' + tableName + ' (id, name, description, owner) VALUES ($1, $2, $3, $4)', [key, value.name, value.description, value.owner],function (err, result) {
            if (err) throw err;
    });

    socket.on('put', (key, value)=>{
        client.query('SELECT * from '+tableName+' where id = $1', [key], function (err, result) {
            if (err) throw err;

            if(result.rows.length==0 || Object.values(socket.rooms).indexOf(value.owner.toString()) == -1)
                return socket.emit('delete', {id: key});

            if (Object.values(socket.rooms).indexOf(result.rows[0].owner.toString()) == -1 || result.rows[0].owner.toString() != value.owner.toString()) {
                return socket.emit('put', {id: key, old: value, new: result.rows[0]});
            }
            client.query('UPDATE ' + tableName + ' SET name = $1,  description = $2, owner = $3 where id = $4', [value.name, value.description, value.owner, key],function (err, result) {
                if (err) throw err;
            });
        });
    });

    socket.on('delete', (key)=>{
        client.query('SELECT * from '+tableName+' where id = $1 ', [key], function (err, result) {
            if (err) throw err;

            if(result.rows.length==0) return ;

            if(Object.values(socket.rooms).indexOf(result.rows[0].owner.toString())==-1) {
                return socket.emit('add', {id: key, new: result.rows[0]});
            }
            client.query('DELETE FROM '+tableName+' where id = $1', [key],function (err, result) {
                if (err) throw err;
            });
        });
    })
});


//start the server
http.listen(3000, function(){
    console.log('listening on *:3000');
});
