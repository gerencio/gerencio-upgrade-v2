# rancher-upgrade-prep
Script that prepares a docker-compose.yml file for running rancher upgrade

Required environment variables:
RANCHER_URL         - the url of the rancher server, ex: http://myrancher.com:8080 
RANCHER_ACCESS_KEY  - your rancher API access key
RANCHER_SECRET_KEY  - your rancher API secret key 
RANCHER_STACK       - the name of your rancher stack, ex: "default", "web"

```
git clone https://github.com/robzhu/rancher-upgrade-prep .
npm install
node main.js docker-compose.yml {service} {imageID}
```

at this point, it's a good idea to commit the new YAML file somewhere.