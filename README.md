# rancher-upgrade-prep
This script wraps the operation "rancher-compose upgrade", intended to be used for integration with CircleCI. 

Inside your CircleCI project settings, set the following environment variables:

```
RANCHER_URL         	- the url of the rancher server, ex: http://myrancher.com:8080/v1/projects/abc
RANCHER_ACCESS_KEY  	- your rancher API access key
RANCHER_SECRET_KEY  	- your rancher API secret key 
RANCHER_STACK       	- the name of your rancher stack, ex: "default", "web"
RANCHER_SERVICE_NAME 	- the name of the service to upgrade, such as "nodecolor"
```

Edit your project's circle.yml file and add the following lines at the end of your deployment phase:

```
- git clone https://github.com/robzhu/rancher-upgrade-prep prep
- cd prep && npm install
- wget -O docker-compose.yml <URL of your docker-compose file from rancher>
- node ./prep/rancher-upgrade.js ./docker-compose.yml $RANCHER_SERVICE_NAME <new docker imageID> 
```

note: at this point, it's a good idea to commit the new YAML file somewhere.