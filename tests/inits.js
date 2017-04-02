/**
 * Created by claudio on 29/03/17.
 */
"use strict";
const pg = require ('pg');
const SyncGateway = require('sync-gateway');
const rp = require('request-promise');

let clientPg;
pg.connect('postgres://test:test@192.168.3.110/test', function(err, clientR) {
    if(err) {
        console.error(err);
        return ;
        process.exit(1);
    }
    clientPg = clientR;
});

module.exports = {
    gun:{
        tableName(data){
            switch(data) {
                case 'collaborative':case 'chat':
                    return Date.now() + 'table1';
                case 'social':
                    return [Date.now()+'posts', Date.now()+'comments'];
            }
        },
        clear(){
            return Promise.resolve();
        },
    },
    traditional:{
        tableName(data){
            switch(data){
                case 'collaborative':case 'chat':
                    return 'test';
                case 'social':
                    return ['posts', 'comments'];
            }
        },
        clear(data){
            let tables = this.tableName(data);
            if(data != 'social')
                tables = [tables];
            let promises = [];
            tables.forEach(table=> {
                promises.push(new Promise((resolve, reject)=>{
                    clientPg.query('DELETE FROM '+table, [],function (err, result) {
                        if (err) {
                            console.error(err);
                            return reject(err);
                        };
                        resolve(result);
                    })}));
            });
            return Promise.all(promises);
        }
    },
    pouch:{
        tableName(data){
            switch(data){
                case 'collaborative':case 'chat':
                    return 'test';
                case 'social':
                    return ['posts', 'comments'];
            }
        },
        clear(){
            return Promise.resolve();//TODO fix
            return rp
                .delete('http://127.0.0.1:5984/test')
                .then(()=>rp.put('http://127.0.0.1:5984/test'));
        }
    },
    couchbase:{
        tableName(data){
            switch(data){
                case 'collaborative':case 'chat':
                    return 'default';
                case 'social':
                    return ['default', 'gamesim-sample'];
            }
        },
        clear(data){
            return Promise.resolve();//TODO fix
            let tables = this.tableName(data);
            if(data != 'social')
                tables = [tables];
            let promises = [];
            tables.forEach(table=>{
                let client = new SyncGateway('http://192.168.3.116:4985',table);
                promises.push(client
                    .allDocs({"include_docs": true})
                    .then((data)=>{
                        //console.log(data);
                        let all = data.rows.map((row)=>{
                            return client.delete(row.doc)
                        });
                        return Promise.all(all);
                    }));
            });
            return Promise.all(promises);
        }
    },
};
