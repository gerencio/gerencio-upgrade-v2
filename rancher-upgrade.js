util        = require('util');
yaml        = require('js-yaml');
writeYaml   = require('write-yaml');
fs          = require('fs');
fse         = require('fs-extra');
download    = require('download');
npmRun      = require('npm-run');

var sourceComposeFile   = process.argv[2];  // the full path of the docker-compose.yml file that describes the current rancher stack
var serviceName         = process.argv[3];  // the name of the service to upgrade
var newServiceImage     = process.argv[4];  // the image of the new service, ex: ezephoenix/webspike:34

filter_keys = function(obj, filter) {
  var key, keys = [];
  for (key in obj) {
    if (obj.hasOwnProperty(key) && key.match(filter)) {
      keys.push(key);
    }
  }
  return keys;
}

try {
  console.log("loading %s", sourceComposeFile);
  var yamlDoc = yaml.safeLoad(fs.readFileSync(sourceComposeFile, "utf8"));
  console.log("searching for service definition: %s", serviceName);

  var expression = util.format("^%s*",serviceName);
  var matches = filter_keys(yamlDoc, expression);

  var currentServiceEntry = null;
  if( matches.length == 0 ){
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
  if(currentServiceEntry == null) {
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

  console.log("inserting new YAML element with name: %s", newServiceName );
  yamlDoc[newServiceName] = newServiceElement;
  
  var targetFile = sourceComposeFile;
  console.log("writing modified YAML file out to %s", targetFile);
  writeYaml.sync(targetFile, yamlDoc);
  console.log("successfully wrote modified YAML file out to %s", targetFile);
  
  var args = util.format("--url %s --access-key %s --secret-key %s -p %s --file %s upgrade %s %s", 
    process.env.RANCHER_URL, 
    process.env.RANCHER_ACCESS_KEY, 
    process.env.RANCHER_SECRET_KEY, 
    process.env.RANCHER_STACK,
    targetFile, 
    currentServiceEntry,
    newServiceName );

  var source = "https://releases.rancher.com/compose/beta/latest/rancher-compose-linux-amd64.tar.gz"
  new download({extract: true})
    .get(source)
    .dest(".")
    .run(function(){
      console.log("rancher-compose downloaded");
      var source = "./rancher-compose-v0.3.0/rancher-compose ";

      var cmd = "rancher-compose " + args;
      console.log(cmd);

      //windows:
      //npmRun.sync("c:/tools/rancher-compose.exe " + args, {cwd: __dirname});

      //linux
      npmRun.sync(source + args, {cwd: __dirname});
      console.log("DONE");
    });
} catch (e) {
    console.log("Deployment failed:")
    console.error(e);
    return 1;
}