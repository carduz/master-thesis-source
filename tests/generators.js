/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const Timer = require('./utils').timer;
const timePromise = require('./utils').timePromise;
const StorePromise = require('./utils').storePromise;
const inits = require('./inits');
const randomstring = require("randomstring");
const debounce = require('debounce');

Object.values = function(obj){
    "use strict";
    return Object.keys(obj).map(function(key) {
        return obj[key];
    });
};

module.exports.collaborative = class{
    constructor(clients, data, client){
        this.clients = clients;
        this.data = data;
        this.client = client;
        this.name = 'collaborative';
        this.counter = 0;
        this.table = inits[client].tableName(this.name);
        this.string = randomstring.generate(data.size);
        this.clients.read.forEach((client, clientPos)=> {
            client.join(this.table, 'testChannel');
        });
    }

    start(){
        return inits[this.client].clear(this.name);
    }

    tick(){
        let timer = new Timer();
        let data = [];
        let dataTodo = [];
        for(let i=0; i< this.clients.write.length; i++) {
            let tmp = this.string + this.counter;
            data.push({description: tmp});
            dataTodo.push(tmp);
            this.counter++;
        }

        let promises = [];
        let times = [];
        this.clients.read.forEach((client, clientPos)=>{
           let todo = JSON.parse(JSON.stringify(dataTodo));
           let promise = new StorePromise();
           let last = todo[todo.length-1]; //eventually consistency
           promises.push(promise.promise);
           let cbId = client.onData((row)=>{
               let pos = todo.indexOf(row.data.description);
               if(pos>=0) todo.splice(pos,1);
               if(todo.length==0 || row.data.description == last){
                   promise.resolve();
                   client.offData(cbId);
                   times[clientPos] = timer.timeInSeconds();
               }
           });
        });
        timer.start();

        this.clients.write.forEach((client, pos)=>{
           client.write(this.table, 'testChannel', data[pos]);
        });

        return Promise.all(promises).then(()=>{
           return {requests: this.clients.write.length+this.clients.read.length,time: timer.timeInSeconds(), times: times};
        });
    }
};

module.exports.chat = class{
    constructor(clients, data, client){
        this.clients = clients;
        this.data = data;
        this.client = client;
        this.counter = 0;
        this.name = 'chat';
        this.table = inits[client].tableName(this.name);
        this.string = randomstring.generate(30);
        this.rooms = Math.ceil(this.clients.write.length/2);//2 writers per room
        this.writeRoom = [];
        this.readRooms = [];
        for(let i = 0; i<this.clients.write.length; i++)
            this.writeRoom[i] = 'room'+(i%this.rooms);
        for(let i = 0; i<this.clients.read.length; i++)
            if(this.rooms>=2)
                this.readRooms[i] = ['room'+(i%this.rooms), 'room'+((i+1)%this.rooms)];
            else
                this.readRooms[i] = ['room'+(i%this.rooms)];

        this.clients.read.forEach((client, clientPos)=> {
            this.readRooms[clientPos].forEach((room)=>{
                client.join(this.table, room);
            });
        });
    }


     start(){
        return inits[this.client].clear(this.name);
     }

    tick(){
        let timer = new Timer();
        let data = [];
        let dataTodo = {};
        for(let i=0; i< this.clients.write.length; i++) {
            let tmp = this.string + this.counter;
            data.push({description: tmp});
            dataTodo[this.writeRoom[i]] = dataTodo[this.writeRoom[i]] || [];
            dataTodo[this.writeRoom[i]].push(tmp);
            this.counter++;
        }

        let promises = [];
        let times = [];
        this.clients.read.forEach((client, clientPos)=>{
            let todo = [];
            this.readRooms[clientPos].forEach((room)=>{
                todo = todo.concat(dataTodo[room]);
            });
            let last = todo[todo.length-1]; //eventually consistency
            let promise = new StorePromise();
            promises.push(promise.promise);
            let cbId = client.onData((row)=>{
                let pos = todo.indexOf(row.data.description);
                if(pos>=0) todo.splice(pos,1);
                if(todo.length==0 || row.data.description == last){
                    promise.resolve();
                    client.offData(cbId);
                    times[clientPos] = timer.timeInSeconds();
                }
            });
        });
        timer.start();

        this.clients.write.forEach((client, pos)=>{
            client.write(this.table, this.writeRoom[pos], data[pos]);
        });

        return Promise.all(promises).then(()=>{
            return {requests: this.clients.write.length+this.clients.read.length,time: timer.timeInSeconds(), times: times};
        });
    }
};

module.exports.social = class{
    constructor(clients, data, client){
        this.clients = clients;
        this.data = data;
        this.client = client;
        this.name = 'social';
        this.table = inits[client].tableName('social'); //0 = posts, 1 = comments
        this.string = randomstring.generate(data.size);
        this.clients.read.forEach((client, clientPos)=> {
            client.join(this.table[0], 'all');
        });
        this.posts = [];
        this.postsNumbers = {};
        this.postCounter = 0;
        this.commentsCounter = 0;
        this.execution = 0;
    }

    start(){
        return inits[this.client].clear(this.name);
    }

    prepareWrite(){
        let ret = {operations: [], postsToDo: {}, commentsToDo:{}, data1: [], data2:[]};
        this.clients.write.forEach((client, pos)=>{
            let type = (this.commentsCounter+ this.postCounter)%11==0?'post':'comment'; //one post every 9 comments
            ret.operations[pos] = type;
            if(type == 'post'){
                this.postCounter++;
                let postId = this.posts.length;
                let tmp = 'post'+postId;
                this.posts.push(tmp);
                ret.postsToDo['k'+pos] = tmp;
                this.postsNumbers['k'+postId] = this.posts.length%2+1;
                this.clients.read.forEach((client, pos)=>{
                    if((this.posts.length+pos)%2)
                        client.join(this.table[1], tmp);
                });
            }else{
                if(this.postCounter==0) return ;
                let tmp = this.string + this.commentsCounter;
                let postid = this.commentsCounter%this.posts.length; //it is not fair, but it is simple
                this.commentsCounter++;
                ret['data'+this.postsNumbers['k'+postid]].push(tmp);
                ret.commentsToDo['k'+pos] = {post: postid, comment: tmp};
            }
        });
        return ret;
    }

    tick(){
        let timer = new Timer();
        let data = this.prepareWrite();

        let number = this.execution++;
        let lastTime = 0;
        let promises = [];
        let times = [];
        //TODO check also posts
        this.clients.read.forEach((client, clientPos)=>{
            let todo = Object.values(data.postsToDo);
            if(clientPos%2)
                todo = todo.concat(data.data1);
            else
                todo = todo.concat(data.data2);
            if(todo.length==0) return;
            let last = todo[todo.length-1]; //eventually consistency
            let promise = new StorePromise();
            let debounced = ()=>{};
            promises.push(promise.promise);
            let cbId = client.onData((row)=>{
                debounced();
                lastTime = timer.timeInSeconds();
                let pos = todo.indexOf(row.data.description);
                if(pos>=0) todo.splice(pos,1);
                if(todo.length==0 || row.data.description == last){
                    promise.resolve();
                    client.offData(cbId);
                    times[clientPos] = lastTime;
                }
            });
            //FIX for couchbase
            debounced = debounce(()=>{
                promise.resolve();
                client.offData(cbId);
                times[clientPos] = lastTime;
            },5000);
            debounced();
        });

        timer.start();

        this.clients.write.forEach((client, pos)=>{
            if(data.operations[pos]=='post')
                client.write(this.table[0], 'all', {description: data.postsToDo['k'+pos]});
            else
                client.write(this.table[1], 'post'+data.commentsToDo['k'+pos].post, {description: data.commentsToDo['k'+pos].comment});
        });

        return Promise.all(promises).then(()=>{
            return {requests: this.clients.write.length+this.clients.read.length,time: timer.timeInSeconds(), times: times};
        });
    }
};
