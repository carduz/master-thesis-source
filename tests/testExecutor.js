/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const GeneralClientLauncher  = require('./generalClientLauncher');
const generators = require('./generators');
const Timer = require('./utils').timer;
const StorePromise = require('./utils').storePromise;
const timePromise = require('./utils').timePromise;
const mkdirp = require('mkdirp');
const stringify = require('csv-stringify');
const stats = require("stats-lite");
const fs = require('fs');
const debounce = require('debounce');
const config = require('./config.json');
const CONCURRENCY = 5;
const TIME_WINDOW = 5;

let execution = Promise.resolve();


function launch(client, generator, data, n){
    try {
        let clients = [];
        let clientsPromises = [];
        for (let i = 0; i < n; i++) {
            let clientTmp = new GeneralClientLauncher(client).start();
            clients.push(clientTmp);
            clientsPromises.push(clientTmp.initPromise.promise);
        }
        return {clients: clients, clientsPromises: clientsPromises};
    }catch(e){
        console.error(e);
        throw e;
    }
}

function execute(client, generatorName, data, clients){
    try {
        let generator = new generators[generatorName](clients, data, client);
        let results = [];
        let totRequests = 0;
        let concurrency = data.concurrency || CONCURRENCY;
        let promise = new StorePromise();
        let activeClients = 0;
        let timer = new Timer();
        let timeLimit = config.time_window || TIME_WINDOW;
        let totTime = 0;
        let emergencyReturn = null;
        if(config.emergencyReturn)
            emergencyReturn = debounce(()=>{
                promise.resolve({totRequests: totRequests, totTime: totTime, results: results});
            },10000); //it returns after 10 seocnds if there are no new data, this to avoid issues due to some clients that has not terminated
        let executeChunk = ()=>{
            let timer2 = new Timer();
            timer2.start();
            let chunk = generator.tick();
            return chunk
                .then(data=>{
                    let time = timer.timeInSeconds();
                    let requests = data.requests;
                    totRequests += requests;
                    let throughput = requests/timer2.timeInSeconds();
                    results.push({time: time, throughput: throughput, data: data});
                    if(time<timeLimit) {
                        //console.log(time);
                        return executeChunk();
                    }
                    activeClients--;
                    totTime = time;
                    if(config.emergencyReturn)
                        emergencyReturn();
                    //console.log(activeClients);
                    //console.log(results);

                    if(activeClients == 0) {
                        if(config.emergencyReturn)
                            emergencyReturn.clear();
                        return promise.resolve({totRequests: totRequests, totTime: totTime, results: results});
                    }
                });
        };
        //.then(()=>generator.start())
        return timePromise(1000).then(()=>generator.start()).then(()=> {
            activeClients = concurrency;
            timer.start();
            for(let i=0; i<concurrency; i++)
                executeChunk();
            return promise.promise;
        }); //delayed execution, to align everything
    }catch(e){
        console.error(e);
        throw e;
    }
}

function strigifyAndSave(dir, file, data, options){

    options = options || {};
    return new Promise((resolve, reject)=>{
        mkdirp(dir, (err)=> {
            if (err) return reject(err);
            stringify(data, options, (err, result)=> {
                if (err) return reject(err);
                fs.writeFile(dir + '/' + file, result, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    })
}


function save(client, generator, key, dataReceived){
    let dir = 'out/'+client+'/'+generator+'/'+key;
    let totRequests = dataReceived.totRequests;
    let totTime = dataReceived.totTime;
    let data = dataReceived.results;
    console.log('throughput', totRequests/totTime);
    let recap = data.map(data=>{
        return {time: data.time, throughput: data.throughput, latency: data.data.time};
    });

    let latency = data
        .map(data=>{
            let times = data.data.times;
            let mean = stats.mean(times);
            let variance = stats.variance(times);

            return {key:data.time, mean: mean, variance: variance};
        });

    //TODO reject?
    strigifyAndSave(dir, 'data.csv', [{totRequests: totRequests, totTime: totTime}], {header: true} );
    strigifyAndSave(dir, 'recap.csv', recap, {header: true} );
    strigifyAndSave(dir, 'latency.csv', latency,  {header: true} );
}

module.exports = function(client, generator, data, key){
    execution = execution.then(()=>{
        console.log('starting', client, generator, data);
        let read = launch(client, generator, data, data.reader);
        let write = launch(client, generator, data, data.writer);
        let clients = read.clients.concat(write.clients);
        return Promise
            .all(read.clientsPromises.concat(write.clientsPromises))
            .then(()=>console.log('created', client, generator, data))
            .then(()=>execute(client, generator, data, {read: read.clients, write: write.clients}))
            .then((results)=>{
                save(client, generator, key, results);
                clients.forEach(client=>client.close());
                console.log('ending', client, generator, data);
                return timePromise(1000);
            });
    });
};
