# update and upgrade
apt-get update -y
apt-get upgrade -y

#install redis
wget http://download.redis.io/releases/redis-3.2.6.tar.gz
tar xzf redis-3.2.6.tar.gz
cd redis-3.2.6
make
make install
cd utils
./install_server.sh
update-rc.d redis_6379 defaults

#config redis
sed  -i "s/protected-mode.*/protected-mode no/" /etc/redis/6379.conf
sed  -i "s/bind.*//" /etc/redis/6379.conf

#clean
apt-get autoremove
apt-get clean

#reboot
reboot
