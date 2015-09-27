util        = require('util');
yaml        = require('js-yaml');
writeYaml   = require('write-yaml');
fs          = require('fs');
fse         = require('fs-extra');
download    = require('download');
npmRun      = require('npm-run');
request     = require('request');
unzip       = require('unzip2');
del         = require('delete');
sh          = require('shelljs/global');

var RANCHER_COMPOSE_LINUX   = "https://releases.rancher.com/compose/beta/latest/rancher-compose-linux-amd64.tar.gz";
var RANCHER_COMPOSE_WINDOWS = "https://releases.rancher.com/compose/beta/latest/rancher-compose-windows-386.zip";
var RANCHER_COMPOSE_OSX     = "https://releases.rancher.com/compose/beta/latest/rancher-compose-darwin-amd64.tar.gz";

var isWin = /^win/.test(process.platform);

var serviceName         = process.argv[2];  // the name of the service to upgrade
var newServiceImage     = process.argv[3];  // the image of the new service, ex: robzhu/nodecolor:54

function run_cmd(cmd, args, cb, end) {
    var spawn = require('child_process').spawn,
        child = spawn(cmd, args),
        me = this;
    child.stdout.on('data', function (buffer) { cb(me, buffer); });
    child.stdout.on('end', end);
};

var filter_keys = function(obj, filter) {
  var key, keys = [];
  for (key in obj) {
    if (obj.hasOwnProperty(key) && key.match(filter)) {
      keys.push(key);
    }
  }
  return keys;
};

var deployUpgrade = function(){
  console.log('DEPLOYMENT STARTING');
  try{
    var sourceComposeFile = "docker-compose.yml";

    console.log("loading %s", sourceComposeFile);
    var yamlDoc = yaml.safeLoad(fs.readFileSync(sourceComposeFile, "utf8"));
    console.log("searching for service definition: %s", serviceName);

    var expression = util.format("^%s*",serviceName);
    var matches = filter_keys(yamlDoc, expression);

    var currentServiceEntry = null;
    if( matches.length === 0 ){
      throw util.format("could not find any services matching name: %s", serviceName);
    }
    else if( matches.length == 1){
      currentServiceEntry = matches[0];
    }
    else{
      console.log("multiple service entries found that match: '%s': %s ", serviceName, matches );

      var maxVersion = 0;
      matches.forEach(function(entry){
          var entryVersion = entry.split('-').pop();
          if(entryVersion > maxVersion){
              maxVersion = entryVersion;
              currentServiceEntry = entry;
          }
      });
    }
    if(currentServiceEntry === null) {
      throw "could not find a matching service entry, giving up";
    }

    console.log("Using service entry: " + currentServiceEntry);

    //TODO: check the docker registry to see if the image actually exists
    var currentServiceElement = yamlDoc[currentServiceEntry];
    console.log(currentServiceElement);
    //clone the service element
    var newServiceElement = (JSON.parse(JSON.stringify(currentServiceElement)));
    newServiceElement.image = newServiceImage;

    //name the new service: 
    var newServiceName = util.format( "%s-%s", serviceName, newServiceImage.split(':').pop() );

    //newServiceName = newServiceName.replace(".","-");
    //replace all instance of '.' with '-' because rancher forbids the '.' in the service name
    newServiceName = newServiceName.split(".").join("-");

    console.log("inserting new YAML element with name: %s", newServiceName );
    yamlDoc[newServiceName] = newServiceElement;
    
    var targetFile = sourceComposeFile;
    console.log("writing modified YAML file out to %s", targetFile);
    writeYaml.sync(targetFile, yamlDoc);
    console.log("successfully wrote modified YAML file out to %s", targetFile);

    if( newServiceName === currentServiceEntry ){
      throw new Error("the service current version and target version are the same, aborting.");
    }
    
    var args = util.format("--url %s --access-key %s --secret-key %s -p %s --file %s upgrade %s %s", 
      process.env.RANCHER_URL, 
      process.env.RANCHER_ACCESS_KEY, 
      process.env.RANCHER_SECRET_KEY, 
      process.env.RANCHER_STACK,
      targetFile, 
      currentServiceEntry,
      newServiceName );

    var source = isWin ? RANCHER_COMPOSE_WINDOWS : RANCHER_COMPOSE_LINUX;
    new download({extract: true})
      .get(source)
      .dest(".")
      .run(function(){
        console.log("rancher-compose downloaded");

        var cmd = "./rancher-compose-v0.4.0/rancher-compose ";
        if(isWin){
          fse.copySync("rancher-compose-v0.4.0/rancher-compose.exe", "rancher-compose.exe" , null, null);
          cmd = "rancher-compose.exe ";
        }

        console.log("running:\n" + cmd + args);

        var exec = require('child_process').exec;
        var exitCode = exec(cmd + args, function(error, stdout, stderr){
          if(error){
            console.log(error);
          }
        });
        // var upgrade = run_cmd(cmd, args, 
        //     function (me, buffer) { me.stdout += buffer.toString() }, 
        //     function() { console.log(upgrade.stdout) }
        //   );
        
        // if(exitCode){
        //   console.log("rancher-compose exited with error code: %s", exitCode);
        // }else {
        //   console.log("DONE");
        // }
        // process.exit(exitCode);
      });
    } catch (e) {
      console.log("Deployment failed:");
      console.error(e);
    process.exit(1);
  }
};

try {

  // RANCHER_URL           - the url of the rancher server, ex: http://myrancher.com:8080/v1/projects/abc
  // RANCHER_ACCESS_KEY    - your rancher API access key
  // RANCHER_SECRET_KEY    - your rancher API secret key 
  // RANCHER_STACK         - the name of your rancher stack, ex: "default", "web"
  // RANCHER_SERVICE_NAME  - the name of the service to upgrade, such as "nodecolor"
  // RANCHER_COMPOSE_URL   - the url where the compose configuration lives

  var server    = process.env.RANCHER_URL;
  if(!server) 
    throw new Error('required env variable: RANCHER_URL- the url of the rancher server, ex: http://myrancher.com:8080/v1/projects/abc');
  var url       = process.env.RANCHER_COMPOSE_URL;
  if(!url) 
    throw new Error('required env variable: RANCHER_COMPOSE_URL- the url where the compose configuration lives');
  var username  = process.env.RANCHER_ACCESS_KEY;
  if(!username) 
    throw new Error('required env variable: RANCHER_ACCESS_KEY- your rancher API access key');  
  var password  = process.env.RANCHER_SECRET_KEY;
  if(!password) 
    throw new Error('required env variable: RANCHER_SECRET_KEY- your rancher API secret key');
  var stack     = process.env.RANCHER_STACK;
  if(!stack) 
    throw new Error('required env variable: RANCHER_STACK- the name of your rancher stack, ex: "default", "web"');
  // var name      = process.env.RANCHER_SERVICE_NAME;
  // if(!name) 
  //   throw new Error('required env variable: RANCHER_SERVICE_NAME- the name of the service to upgrade, such as "nodecolor"');

  fse.removeSync("docker-compose.yml");
  fse.removeSync("rancher-compose.yml");

  console.log("downloading rancher compose config...");
  console.log(url);

  var r = request.get(url).auth(username, password, true)
  .pipe(unzip.Extract({path: '.'}))
  .on('close',deployUpgrade)
  .on('error', function(err){
    console.log("OH SHIT:");
    console.error(err);
  });
} catch (e) {
    console.log("Initialization failed:");
    console.error(e);
    process.exit(1);
}