/**
 * Created by claudio on 30/03/17.
 */
"use strict";
const WebSocket = require('ws');
const SyncGateway = require('sync-gateway');

module.exports = class{
    constructor(table){
        this.ws = new WebSocket("ws://192.168.3.116:4985/"+table+"/_changes?feed=websocket");
        this.client = new SyncGateway('http://192.168.3.116:4985',table);
        this._onData = ()=>{};
        this.ws.on('open', ()=>{
            //console.log('connected');
            this.ws.send(JSON.stringify({"include_docs": true}));
        });
        this.ws.on('message', (message) => {
            //console.log('Received: ' + message);
            try{
                message = JSON.parse(message);
            }catch(e){
                return ;
            }
            this._onData(message);
        });

        this.ws.on('close', (code) => {
            //console.error('Disconnected: ' + code);
        });

        this.ws.on('error', (error) => {
            console.error('Error: ' + error.code);
        });
    }

    onData(cb){
        this._onData = cb;
    }

    write(doc){
        this.client.post(doc);
    }

    close(){
        this._onData = ()=>{};
        try {
            this.ws.close();
        }catch(e){
            console.error(e);
        }
    }
};
