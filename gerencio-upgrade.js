#! /usr/bin/env node

var util = require('util')
var yaml = require('js-yaml')
var writeYaml = require('write-yaml')
var fs = require('fs')
var fse = require('fs-extra')
var fss = require('fs-sync')
var Download = require('download')
var request = require('request')
var unzip = require('unzip2')
var path = require('path')
var argv = require('minimist')(process.argv.slice(2))

var RANCHER_COMPOSE_LINUX = 'https://releases.rancher.com/compose/beta/latest/rancher-compose-linux-amd64.tar.gz'
var RANCHER_COMPOSE_WINDOWS = 'https://releases.rancher.com/compose/beta/latest/rancher-compose-windows-386.zip'
var RANCHER_COMPOSE_OSX = 'https://releases.rancher.com/compose/beta/latest/rancher-compose-darwin-amd64.tar.gz'

// the rancher-compose archives above contain an intermediate folder that varies by version
// this should be periodically updated as rancher releases new versions
var isWin = /^win/.test(process.platform)
var isOSX = /^darwin/.test(process.platform)

var serviceName = argv['_'][0]  // the name of the service to upgrade
var interval = argv['_'][1]  // interval in miliseconds to change version in nodes
var newServiceImage = argv['_'][2]  // the image of the new service, ex: robzhu/nodecolor:54
var newServiceTag = argv['_'][3]  // the image of the new service, ex: robzhu/nodecolor:54
var filterKeys = function (obj, filter) {
  var key
  var keys = []
  for (key in obj) {
    if (obj.hasOwnProperty(key) && key.match(filter)) {
      keys.push(key)
    }
  }
  return keys
}

var getSource = function () {
  var urlLinux = 'https://releases.rancher.com/compose/' + argv['COMPOSE_VERSION'] + '/rancher-compose-linux-amd64-' + argv['COMPOSE_VERSION'] + '.tar.gz'
  var urlWindows = 'https://releases.rancher.com/compose/' + argv['COMPOSE_VERSION'] + '/rancher-compose-windows-386-' + argv['COMPOSE_VERSION'] + '.zip'
  var urlOSX = 'https://releases.rancher.com/compose/' + argv['COMPOSE_VERSION'] + '/rancher-compose-darwin-amd64-' + argv['COMPOSE_VERSION'] + '.tar.gz'
  var source = argv['COMPOSE_VERSION'] ? urlLinux : RANCHER_COMPOSE_LINUX
  if (isWin) {
    source = argv['COMPOSE_VERSION'] ? urlWindows : RANCHER_COMPOSE_WINDOWS
  }
  if (isOSX) {
    source = argv['COMPOSE_VERSION'] ? urlOSX : RANCHER_COMPOSE_OSX
  }
  return source
}

var getDir = function () {
  var dir = 'rancher-compose-v0.12.5'
  if (argv['COMPOSE_VERSION']) {
    return 'rancher-compose-' + argv['COMPOSE_VERSION']
  } else {
    return dir
  }
}

var deployUpgrade = function () {
  console.log('DEPLOYMENT STARTING')
  try {
    var sourceComposeFile = 'docker-compose.yml'
    var rancherComposeFile = 'rancher-compose.yml'

    console.log('loading %s', sourceComposeFile)
    var yamlDoc = yaml.safeLoad(fs.readFileSync(sourceComposeFile, 'utf8'))
    console.log('searching for service definition: %s', serviceName)
    var currentServiceEntry = null

    if (Object.keys(yamlDoc).filter(function (d) { return d === 'services' }).length) {
      // Docker-compose v2
      var expression = util.format('^%s*', serviceName)
      var matches = filterKeys(yamlDoc['services'], expression)
      if (matches.length === 0) {
        throw util.format('could not find any services matching name: %s', serviceName)
      } else {
        if (matches.length === 1) {
          currentServiceEntry = matches[0]
        } else {
          console.log("multiple service entries found that match: '%s': %s ", serviceName, matches)

          var maxVersion = 0
          matches.forEach(function (entry) {
            var entryVersion = entry.split('-').pop()
            if (entryVersion > maxVersion) {
              maxVersion = entryVersion
              currentServiceEntry = entry
            }
          })
        }
        if (currentServiceEntry === null) {
          throw Error('could not find a matching service entry, giving up')
        }
      }

      console.log('Using service entry: ' + currentServiceEntry)

      // TODO: check the docker registry to see if the image actually exists
      var currentServiceElement = yamlDoc['services'][currentServiceEntry]
      console.log(currentServiceElement)
      // clone the service element
      var newServiceElement = (JSON.parse(JSON.stringify(currentServiceElement)))
      newServiceElement.image = newServiceImage + ':' + (newServiceTag || 'latest')
      yamlDoc['services'][currentServiceEntry] = newServiceElement
    } else {
      // Old Model docker-compose
      var v1Expression = util.format('^%s*', serviceName)
      var v1Matches = filterKeys(yamlDoc, v1Expression)
      if (v1Matches.length === 0) {
        throw util.format('could not find any services matching name: %s', serviceName)
      } else {
        if (v1Matches.length === 1) {
          currentServiceEntry = v1Matches[0]
        } else {
          console.log("multiple service entries found that match: '%s': %s ", serviceName, v1Matches)

          var v1MaxVersion = 0
          v1Matches.forEach(function (entry) {
            var entryVersion = entry.split('-').pop()
            if (entryVersion > v1MaxVersion) {
              v1MaxVersion = entryVersion
              currentServiceEntry = entry
            }
          })
        }
        if (currentServiceEntry === null) {
          throw Error('could not find a matching service entry, giving up')
        }
      }

      console.log('Using service entry: ' + currentServiceEntry)

      // TODO: check the docker registry to see if the image actually exists
      var v1CurrentServiceElement = yamlDoc[currentServiceEntry]
      console.log(v1CurrentServiceElement)
      // clone the service element
      var v1newServiceElement = (JSON.parse(JSON.stringify(v1CurrentServiceElement)))
      v1newServiceElement.image = newServiceImage + ':' + (newServiceTag || 'latest')
      yamlDoc[currentServiceEntry] = v1newServiceElement
    }

    var targetFile = sourceComposeFile
    console.log('writing modified YAML file out to %s', targetFile)
    writeYaml.sync(targetFile, yamlDoc)
    console.log('successfully wrote modified YAML file out to %s', targetFile)
    var args = util.format('--url %s --access-key %s --secret-key %s -p %s --file %s --rancher-file %s up -d --batch-size 1 --interval %s --confirm-upgrade  --pull  --force-upgrade %s',
      argv['GERENCIO_URL'] || process.env.GERENCIO_URL,
      argv['GERENCIO_ACCESS_KEY'] || process.env.GERENCIO_ACCESS_KEY,
      argv['GERENCIO_SECRET_KEY'] || process.env.GERENCIO_SECRET_KEY,
      argv['GERENCIO_STACK'] || process.env.GERENCIO_STACK,
      targetFile,
      rancherComposeFile,
      interval,
      currentServiceEntry
      )

    var source = getSource()

    new Download({extract: true})
      .get(source)
      .dest('.')
      .run(function () {
        console.log('rancher-compose downloaded')

        var cmd = null
        if (isWin) {
          console.log('Detected environment: Windows')
          console.log('copying rancher-compose.exe to working directory...')
          var composeFilePath = path.join('./', getDir(), 'rancher-compose.exe')
          fss.copy(composeFilePath, './rancher-compose.exe')

          cmd = 'rancher-compose.exe '
        } else if (isOSX) {
          console.log('Detected environment: OSX')
          cmd = getDir() + '/rancher-compose '
        } else {
          console.log('Detected environment: Linux')
          cmd = getDir() + '/rancher-compose '
        }

        console.log('running:\n' + cmd + args)

        var exec = require('child_process').exec
        exec(cmd + args, function (error, stdout, stderr) {
          if (error) {
            console.log(error)
          }
        })
      })
  } catch (e) {
    console.log('Deployment failed:')
    console.error(e)
    process.exit(1)
  }
}

try {
  // GERENCIO_URL           - the url of the rancher server, ex: http://myrancher.com:8080/v1/projects/abc
  // GERENCIO_ACCESS_KEY    - your rancher API access key
  // GERENCIO_SECRET_KEY    - your rancher API secret key
  // GERENCIO_STACK         - the name of your rancher stack, ex: "default", "web"
  // GERENCIO_SERVICE_NAME  - the name of the service to upgrade, such as "nodecolor"
  // GERENCIO_COMPOSE_URL   - the url where the compose configuration lives
  var server = argv['GERENCIO_URL'] || process.env.GERENCIO_URL
  if (!server) {
    throw new Error('required env variable: GERENCIO_URL- the url of the gerenc.io server, ex: http://cloud.gerenc.io.com/v1/projects/abc')
  }
  var url = argv['GERENCIO_COMPOSE_URL'] || process.env.GERENCIO_COMPOSE_URL
  if (!url) {
    throw new Error('required env variable: GERENCIO_COMPOSE_URL- the url where the compose configuration lives')
  }
  var username = argv['GERENCIO_ACCESS_KEY'] || process.env.GERENCIO_ACCESS_KEY
  if (!username) {
    throw new Error('required env variable: GERENCIO_ACCESS_KEY- your gerenc.io API access key')
  }
  var password = argv['GERENCIO_SECRET_KEY'] || process.env.GERENCIO_SECRET_KEY
  if (!password) {
    throw new Error('required env variable: GERENCIO_SECRET_KEY- your gerenc.io API secret key')
  }
  var stack = argv['GERENCIO_STACK'] || process.env.GERENCIO_STACK
  if (!stack) {
    throw new Error('required env variable: GERENCIO_STACK- the name of your rancher stack, ex: "default", "web"')
  }

  fse.removeSync('docker-compose.yml')
  fse.removeSync('rancher-compose.yml')

  console.log('downloading rancher compose config...')
  console.log(url)

  request.get(url).auth(username, password, true)
  .pipe(unzip.Extract({path: '.'}))
  .on('close', deployUpgrade)
  .on('error', function (err) {
    console.error(err)
  })
} catch (e) {
  console.log('Initialization failed:')
  console.error(e)
  process.exit(1)
}
