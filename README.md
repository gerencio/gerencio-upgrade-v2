# rancher-upgrade
This script upgrades a single service to a new container ID in a target rancher environment. It does this by wrapping "rancher-compose upgrade A B" and providing all the requisite environment parameters via environment variables. 

```
RANCHER_URL         	- the url of the rancher server, ex: http://myrancher.com:8080/v1/projects/abc
RANCHER_ACCESS_KEY  	- your rancher API access key
RANCHER_SECRET_KEY  	- your rancher API secret key 
RANCHER_STACK       	- the name of your rancher stack, ex: "default", "web"
RANCHER_COMPOSE_URL		- the url where the compose configuration lives, ex: http://myrancher.com:8080/v1/projects/foo/environments/bar/composeconfig
```

Then run:
```
node ./rancher-upgrade.js {serviceNam} {imageId}
node ./rancher-upgrade.js nodecolor robzhu/nodecolor:0.3.1
```

## CircleCI integration
Edit your project's circle.yml file and add the following lines at the end of your deployment phase:

```
- git clone https://github.com/robzhu/rancher-upgrade 
- cd rancher-upgrade && npm install
- node ./rancher-upgrade/rancher-upgrade.js $RANCHER_SERVICE_NAME <new docker imageID> 
```
