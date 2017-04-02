# update and upgrade
apt-get update -y
apt-get upgrade -y

#install nodejs
apt-get install nodejs-legacy npm -y

#config listener
mkdir /var/node_listener
chown nobody:nobody /var/node_listener
cd /var/node_listener
sudo npm install pg socket.io-emitter
sudo echo "#! /usr/bin/node
var pg = require ('pg');
var io = require('socket.io-emitter')({ host: '192.168.3.111', port: 6379 });
pg.connect('postgres://test:test@192.168.3.110/test', function(err, client) {
    if(err) {
        console.error(err);
        return ;
    }
    client.on('notification', function(msg) {
        if (msg.name === 'notification' && msg.channel === 'table_update') {
            var pl = JSON.parse(msg.payload);
            var op = pl.type.toLowerCase();
            io.of('/'+pl.table).to(pl.channel).emit(op, {id: pl.id, old: JSON.parse(pl.old), new: JSON.parse(pl.new)});
        }
    });
    client.query('LISTEN table_update');
});">index.js
sudo chmod +x index.js
cd

#set listener as deamon
sudo echo "nohup /var/node_listener/index.js  </dev/null   >/dev/null 2>&1 &
exit 0" > /etc/rc.local

#clean
apt-get autoremove
apt-get clean

#reboot
reboot
