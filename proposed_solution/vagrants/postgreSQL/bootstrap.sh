# update and upgrade
apt-get update -y
apt-get upgrade -y

#install postgresql
apt-get install postgresql-9.5 -y

#config postgresql
#sed -c -i "s/\($TARGET_KEY *= *\).*/\1$REPLACEMENT_VALUE/" $CONFIG_FILE
sudo -u postgres sed  -i "s/#*listen_addresses *=.*/listen_addresses = '\*'/" /etc/postgresql/9.5/main/postgresql.conf
sudo -u postgres echo "host    all    all    all    md5" >> /etc/postgresql/9.5/main/pg_hba.conf
sudo -u postgres createuser test -s
sudo -u postgres psql -c "ALTER USER test WITH ENCRYPTED PASSWORD 'test';"
sudo -u postgres psql -c "CREATE DATABASE test OWNER test;"

#create table, function and trigger
sudo -u postgres psql -d "test" -c "CREATE EXTENSION pgcrypto;"
sudo -u postgres psql -d "test" -c "CREATE TABLE test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(30),
    description text,
    channel varchar(255)
);"
sudo -u postgres psql -d "test" -c "CREATE OR REPLACE FUNCTION table_update_notify() RETURNS trigger AS \$\$
DECLARE
  id UUID;
  channel TEXT;
  old_v TEXT;
  new_v TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    id = NEW.id;
    channel = NEW.channel;
  ELSE
    id = OLD.id;
    channel = OLD.channel;
  END IF;

  IF TG_OP = 'INSERT' THEN
    old_v := '{}';
 ELSE
    old_v := (SELECT  ('[' || row_to_json(OLD) || ']')::json ->> 0);
 END IF;

 IF TG_OP = 'DELETE' THEN
    new_v := '{}';
 ELSE
   new_v := (SELECT  ('[' || row_to_json(NEW) || ']')::json ->> 0);
 END IF;

 PERFORM pg_notify('table_update', json_build_object('table', TG_TABLE_NAME, 'old',old_v, 'new', new_v, 'id', id, 'channel', channel, 'type', TG_OP)::text);

 RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;"
sudo -u postgres psql -d "test" -c "CREATE TRIGGER notify_trigger
AFTER INSERT OR UPDATE OR DELETE ON test
FOR EACH ROW
EXECUTE PROCEDURE table_update_notify();"

#clean
apt-get autoremove
apt-get clean

#reboot
reboot
