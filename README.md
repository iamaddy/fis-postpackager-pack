fis-postpackager-pack
=====================

fis-postpackager-pack

fis pack 
```
fis.config.set('pack', {
'pkg/lib.js': [
'/lib/**.js'
])
```
HTML页面
```
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>Todo</title>
    <script type="text/javascript">
    var url = __pkg('/pkg/lib.js');
```
构建之后，将` __pkg('/pkg/lib.js')`替换为打包后的资源
```
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>Todo</title>
    <script type="text/javascript">
    var url = 'pkg/lib_ac2f5ba.js';
```
插件说明http://www.iamaddy.net/2015/01/develop-fis-plugins/
