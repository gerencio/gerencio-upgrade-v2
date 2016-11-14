# gerencio-upgrade
This script upgrades a single service to a new container ID in a target gerenc.io environment. It does this by wrapping "rancher-compose upgrade A B" and providing all the requisite environment parameters via environment variables. 

[![Build Status](https://travis-ci.org/gerencio/gerencio-upgrade-v2.svg?branch=master)](https://travis-ci.org/gerencio/gerencio-upgrade-v2)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)


```
GERENCIO_URL         	- the url of the gerencio server, ex: http://myrancher.com:8080/v1/projects/abc
GERENCIO_ACCESS_KEY  	- your gerencio API access key
GERENCIO_SECRET_KEY  	- your gerencio API secret key 
GERENCIO_STACK       	- the name of your gerencio stack, ex: "default", "web"
GERENCIO_COMPOSE_URL		- the url where the compose configuration lives, ex: https://cloud.gerenc.io/v1/projects/foo/environments/bar/composeconfig
```

Then run:
```
node ./gerencio-upgrade.js {serviceNam} {imageId}
node ./gerencio-upgrade.js nodecolor xdevelsistemas/taiga-docker:0.3.1
```

## CircleCI integration
Edit your project's circle.yml file and add the following lines at the end of your deployment phase:

```
- npm install -g gerencio-upgrade 
- gerencio-upgrade $RANCHER_SERVICE_NAME <new docker imageID> 
```
