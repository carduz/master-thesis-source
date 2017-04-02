/**
 * Created by claudio on 27/03/17.
 */
"use strict";
const plan = require('./plan.json');
const executor = require('./testExecutor');
Object.keys(plan).forEach(key=>{
    let value = plan[key];
    Object.keys(value).forEach(key2=>{
        let value2 = value[key2];
        value2.forEach((value3, pos)=>{
            executor(key, key2, value3, pos);
        })
    });
});
