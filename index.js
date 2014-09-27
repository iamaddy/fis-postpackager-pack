/*
 * fis
 */

'use strict';

var map = exports.lang = (function(){
    var keywords = ['pkg'],
        LD = '<<<', RD = '>>>',
        qLd = fis.util.escapeReg(LD),
        qRd = fis.util.escapeReg(RD),
        map = {
            reg : new RegExp(
                qLd + '(' + keywords.join('|') + '):([\\s\\S]+?)' + qRd,
                'g'
            )
        };
    keywords.forEach(function(key){
        map[key] = {};
        map[key]['ld'] = LD + key + ':';
        map[key]['rd'] = RD;
    });
    return map;
})();

function trimQuery(url){
    if (url.indexOf("?") !== -1) {
        url = url.slice(0, url.indexOf("?"));
    }
    return url;
}


/**
 * 获取html页面中的<script ... src="path"></script> 资源
 * 获取html页面中的<link ... rel="stylesheet" href="path" /> 资源
 * 由于已经在标准流程之后，无需处理inline
 * 不需要改动页面中内嵌的样式
 * 需要将页面中内嵌的脚本移动到所有脚本的最下方
 * 需要去除注释内的引用
 * @param content
 * @param pathMap
 * @param usePlaceholder
 */
function analyzeHtml(content, pathMap, callback) {
    var reg = /(<script(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>))([\s\S]*?)(?=<\/script\s*>|$)|(<style(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>))([\s\S]*?)(?=<\/style\s*>|$)|<(img|embed|audio|video|link|object|source)\s+[\s\S]*?["'\s\w\/\-](?:>|$)|<!--inline\[([^\]]+)\]-->|<!--(?!\[)([\s\S]*?)(-->|$)/ig;
    callback = callback || function(m, $1, $2, $3, $4, $5, $6, $7, $8){
        if($1){//<script>
            if(!/\s+type\s*=/i.test($1) || /\s+type\s*=\s*(['"]?)text\/javascript\1/i.test($1)) {
                //without attrubite [type] or must be [text/javascript]
                m = $1 + extJs($2);
            }
        }
        return m;
    };
    return content.replace(reg, callback);
}

function extJs(content, callback){
    var reg = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__pkg)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;
    callback = callback || function(m, comment, type, value){
        if(type){
            switch (type){
                case '__inline':
                    m = map.jsEmbed.ld + value + map.jsEmbed.rd;
                    break;
                case '__pkg':
                    m = map.pkg.ld + value + map.pkg.rd;
                    break;
            }
        }
        return m;
    };
    return content.replace(reg, callback);
}

function getResourcePathMap(ret, conf, settings, opt) {
    var map = {};
    fis.util.map(ret.map.res, function (subpath, file) {
        map[trimQuery(file.uri)] = subpath;
    });
    fis.util.map(ret.pkg, function (subpath, file) {
        map[trimQuery(file.getUrl(opt.hash, opt.domain))] = file.getId();
    });
    return map;
}

function getPackMap(ret, conf, settings, opt){
    var uriToIdMap = {};
    var fileToPack = {};
    var packToFile = {};
    fis.util.map(ret.map.pkg, function(id, pkg){
        uriToIdMap[pkg.uri] = id;
    });
    fis.util.map(ret.pkg, function (subpath, file) {
        var uri = file.getUrl(opt.hash, opt.domain);
        var id = uriToIdMap[uri];
        if (id){
            //没有ID的PKG文件无需建立MAP
            packToFile[id] = file;
            fileToPack[file.getId()] = {
                id: id,
                pkg : ret.map.pkg[id]
            };
        }
    });
    return {
        packToFile: packToFile,
        fileToPack: fileToPack
    };
}

/**
 * 将页面依赖的资源与打包资源对比合并
 * @param resources
 * @param ret
 * @param fullPackHit 是否要求资源整体命中打包对象
 * @returns {Array}
 */
function getPkgResource(resources, ret, fullPackHit) {
    var pkgList = {};
    var list = [];
    var handled = {};
    var idList = resources.map(function(resource){
       return  resource.id;
    });
    var resourceMap = {};
    resources.forEach(function(resource){
        resourceMap[resource.id] = resource;
    });

    function fullPackPass(resource){
        if (!fullPackHit){
            return true;
        }
        var pkg = ret.map.pkg[ret.map.res[resource.id].pkg];
        var unHit = pkg.has.filter(function (id) {
            return idList.indexOf(id) == -1;
        });
        return unHit.length === 0;
    }

    function addPkg(id, pkg, srcId){
        if (pkgList[id])
            return;
        var head = false;
        pkg.has.forEach(function(inPkg){
            handled[inPkg] = true;
            if (resourceMap[inPkg]){
                head = head || (resourceMap[inPkg].head || false);
            }
        });
        pkgList[id] = true;
        list.push({
            type: 'pkg',
            id: id,
            srcId: srcId,
            head: head
        });
    }

    resources.forEach(function (resource) {
        var id = resource.id;
        if (handled[id]){
            return false;
        }
        //当前资源是pack打包后的结果
        console.log(ret);
        if (ret.packMap.fileToPack[id]){
            var pack = ret.packMap.fileToPack[id];
            addPkg(pack.id, pack.pkg, id);
            return true;
        }
        var res = ret.map.res[id];
        handled[id] = true;
        if (res.pkg && fullPackPass(resource)) {
            addPkg(res.pkg, ret.map.pkg[res.pkg], id);
        } else {
            list.push({
                type: 'res',
                id: id
            });
        }
    });
    return list;
}





module.exports = function (ret, conf, settings, opt) { //打包后处理
    if (!opt.pack){
        return;
    }
    var pathMap = getResourcePathMap(ret, conf, settings, opt);
    ret.packMap = getPackMap(ret, conf, settings, opt);
    fis.util.map(ret.src, function (subpath, file) {
        if (file.isHtmlLike && file.noMapJs !== false) { //类html文件
            var content = file.getContent();
            var result = analyzeHtml(content, pathMap);
            result = result.replace(map.reg, function(all, type, value){
                var ret = '', info;
                try {
                    if(type === 'pkg'){
                        ret = value;
                        for(var file in pathMap){
                            if(value === "'/" + pathMap[file] + "'"){
                                ret = "'" + file.substr(1) + "'";
                            }
                        }
                    }
                }catch(ex){}
                return ret;
            });
            file.setContent(result);
            if (file.useCache){
                ret.pkg[file.subpath] = file;
            }
        }
    });
};
