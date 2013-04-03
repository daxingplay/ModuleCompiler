/**
 *
 * @author: 橘子<daxingplay@gmail.com>
 * @time: 13-3-12 11:41
 * @description:
 */

var fs = require('fs'),
    path = require('path'),
    colors = require('colors'),
    _ = require('lodash'),
    iconv = require('iconv-lite'),
    Compiler = require('./lib/compiler'),
    utils = require('./lib/utils'),
    parseConfig = require('./lib/parse-config');

function joinCombo(mods){
    var result = [];
    if(!_.isArray(mods)){
        mods = [mods];
    }
    _.forEach(mods, function(mod){
        _.forEach(mod, function(subMods, modName){
            !_.isEmpty(subMods) && result.push("'" + modName + "': { requires: ['" + subMods.join("', '") + "']}");
        });
    });
    return result.length ? "KISSY.config('modules', {\n " + result.join(", \n") + " \n});" : "";
}

module.exports = {
    _config: {},
    config: function(cfg){
        var self = this;
        if(cfg){
            self._config = parseConfig.parse(cfg, self._config);
        }
        self._config.packages = [];
        for(var pkg in self._config.pkgs){
            self._config.packages.push(self._config.pkgs[pkg]);
        }
        return this._config;
    },
    analyze: function(inputFile){
        var self = this;
        // to make sure there is at least one package in config.
        self._config = parseConfig.check(self._config, inputFile);
        // start to analyze.
        var c = new Compiler(self._config);
        console.log(c.modules);
        return c.analyze(inputFile);
    },
    build: function(inputFilePath, outputFilePath, outputCharset, depFile){
        var self = this,
            c,
            config,
            target = path.resolve(inputFilePath),
            result = {
                'success': true,
                'files': []
            },
            combo = [];
        self._config = parseConfig.check(self._config, inputFilePath);
        config = _.cloneDeep(self._config);
        if(fs.existsSync(target)){
            if(fs.statSync(target).isDirectory()) {
                var targets = fs.readdirSync(target);
                for (var i in targets) {
                    if(!self._isFileIgnored(targets[i])){
                        var inputFile = path.resolve(target, targets[i]),
                            outputFile = path.join(outputFilePath, targets[i]);
                        if(path.extname(inputFile)==='.js') {
                            c = new Compiler(config);
                            var re = c.build(inputFile, outputFile, outputCharset);
                            re.modules = c.modules;
                            depFile && combo.push(re.autoCombo);
                            result.files.push(re);
                        }
                    }
                }
            } else {
                c = new Compiler(config);
                var re = c.build(target, outputFilePath, outputCharset);
                re.modules = c.modules;
                depFile && combo.push(re.autoCombo);
                result.files.push(re);
            }
        }else{
            // MC.build('pkgName/abc');
            var modulePath = self.getModulePath(inputFilePath);
            if(modulePath){
                c = new Compiler(config);
                var re = c.build(modulePath, outputFilePath, outputCharset);
                depFile && combo.push(re.autoCombo);
                result.files.push(re.dependencies);
            }else{
                result.success = false;
                !config.silent && console.info('[err]'.bold.red + ' cannot find target: %s', target);
            }
        }
        if(depFile){
            utils.writeFileSync(path.resolve(path.dirname(outputFilePath), depFile), joinCombo(combo), outputCharset);
        }
        return result;
    },
    combo: function(inputFile, depFileName, depFileCharset){
        var self = this,
            content,
            config;
        self._config = parseConfig.check(self._config, inputFile);
        config = _.cloneDeep(self._config);
        var c = new Compiler(config);
        c.analyze(inputFile);
        content = c.combo();
        if(content && depFileName){
            utils.writeFileSync(depFileName, content, depFileCharset);
        }
        return content;
    },
    clean: function(){
        this._config = {
            packages: [],
            exclude: [],
            charset: '',
            silent: false
        };
        return true;
    }
};