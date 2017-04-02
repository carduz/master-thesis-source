"use strict";
const LocalDatabase = require('./localDb');
const IOClient = require('socket.io-client');

let ioClient = IOClient('http://192.168.3.114:3000/test');
let client = new LocalDatabase.Database(new LocalDatabase.Client(ioClient));
client.onChange((key,value)=>{
	console.log(key, value==null? 'deleted' : value); //print new value
});
client.auth('psw1'); //authentication
client.join(1); //join on channel 1
client.join(2); //join on channel 1
client.add({description: 'test', owner: 1}); //write a data
client.add({description: 'test2', owner: 1}); //write a data
console.log(client.data); //print all data
