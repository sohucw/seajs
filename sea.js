VERSION: 2.1.1

The tree structure of Seajs source code:

.
├── intro.js
├── sea.js
├── util-lang.js
├── util-events.js
├── util-path.js
├── util-request.js
├── util-deps.js
├── module.js
├── config.js
└── outro.js
intro.js 和 outro.is 相当于是整个源码的一个包装器(Wrapper), 如下:

(function(global, undefined) {
    // 如果seajs已经加载了, 不再重复加载.
    if (global.seajs) {
        return;
    }
    // ... Source codes are going here.
})(this);
sea.js

// 定义seajs变量, 并赋予为全局变量global的属性seajs.
var seajs = global.seajs = {
    // 这里是定义seajs的版本号的地方.它将通过build工具(如grunt)被替换成在package.json文件中定义的真实的版本号.
    version: "@VERSION"
}
// 定义变量data为一个空对象, 并赋予为变量seajs的data属性.
var data = seajs.data = {}

=========================================================
util-lang.js 有关JS语言增强

function isType(type) {
    return function(obj) {
        // 这里使用Object原型的toString方法来判断传入对象的类型.
        // {} - '[object Object]'
        // '' - '[object String]'
        // [] - '[object Array]'
        // function(){} - '[object Function]'
        return Object.prototype.toString.call(obj) === "[object " + type + "]"
    }
}

var isObject = isType("Object") 
var isString = isType("String")
// 如果JS宿主支持原生的Array.isArray方法, 优先使用
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")

var _cid = 0
// 用来生成不重复的数字ID
function cid() {
    return _cid++
}
util-events.js 事件支持

// 定义变量events为一个空对象, 并赋给变量seajs.data.events
var events = data.events = {}

// 事件绑定
seajs.on = function(name, callback) {
    // 定义变量list, 如果事件列表中已经存在该事件的listeners, 设其为该事件上已绑定的listeners.
    // 如果事件列表中还没有该事件的listeners, 设置该事件上绑定的listeners为空数组, 并赋给变量list.
    var list = events[name] || (events[name] = [])
    // 将传入的监听器或者称之为回调函数加到当前事件的listeners.
    list.push(callback)
    // 返回对象seajs, 这样可以象jQuery一样链式调用.
    return seajs
}

// 事件移除.
// 如果传入事件名, 但未传入要移除的监听器, 将把事件name上所有的监听器都移除掉.
// 如果事件名和监听器都没有传入, 将把所有事件上的所有监听器都移除掉. Note: (危险操作, 需谨慎)
seajs.off = function(name, callback) {
    // 如果事件名和监听器都没有传入, 
    if (!(name || callback)) {
        // 将events和data.events置空
        events = data.events = {}
        // 返回对象seajs, 这样可以象jQuery一样链式调用.
        return seajs
    }

    // 获取当前事件name的监听器列表, 并赋值给变量list
    var list = events[name]
    // 如果当前事件name上有相应的监听器
    if (list) {
        // 如果传入的想要移除的监听器非空
        if(callback) {
            // 迭代所有的监听器
            for (var i = list.length - 1; i >= 0; i--) {
                // 如果发现其中有要移除的监听器
                if (list[i] === callback) {
                    // 把要移除的监听器从监听器列表中删去.
                    list.splice(i, 1)
                }
            }
        } else {
            // 如果没有传入的想要移除的监听器, 移除当前事件上所有的监听器.
            delete events[name]
        }
    }
    // 返回对象seajs以便链式调用.
    return seajs    
}

// 触发事件, 所有的监听器都会激活, 并且传入与emit方法相同的参数(不含事件名).
// 定义方法emit并传递给seajs.emit
var emit = seajs.emit = function(name, data) {
    // 定义变量list为当前事件name的所有监听器列表.
    // 定义变量fn为某个监听器
    var list = events[name], fn
    // 如果当前事件name上含有监听器
    if (list) {
        // 复制监听器列表以防止修改
        list = list.slice()
        // 迭代所有的监听器, 从中依次取出
        while ((fn = list.shift())) {
            // 执行取出的监听器, 传入与emit方法相同的参数(不含事件名)
            fn(data)
        }
    }
    // 返回对象seajs以便链式调用.
    return seajs
}
========================================================
util-path.js 处理文件路径, ID, URI

// 关于文件夹(目录)的正则表达式
// [^?#] 表示不是?和#的任意其他字符
// [^?#]* 表示这样的字符有0到多个
// [^?#]*\/ 表示再加上一个斜杠字符
var DIRNAME_RE = /[^?#]*\//

// 关于"点"(代表当前路径)的正则表达式, 全局匹配
// \/\.\/ 表示字符串/./
var DOT_RE = /\/\.\//g
// 关于双点(代表上一级路径)的正则表达式, 
// 表示: 斜杠,一到多个非斜杠字符,斜杠,两点,斜杠
// 例如: /abc/../
// \/ 表示斜杠
// [^/]+ 表示一到多个的非斜杠字符
// \/\.\.\/ 表示/../
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//

// 从路径中提取出文件所在目录
// 如: dirname("a/b/c.js?t=123#xx/zz") 得到 "a/b/"
function dirname(path) {
    // 由于这里的正则表达式没有g, 返回数组的第一个元素, 即匹配到的文本.
    // NOTE: 使用match方法时,如果正则没有标志g, 并且找到匹配的, 返回的数组存放的第一个元素为匹配的文本, 
    // 使用[0]取出, 第二个元素为对象属性, 可以使用['index']取出. 存放的第三个元素也为一个对象属性, 
    // 可以使用['input']取出. 如果没有找到匹配的, 返回null.
    // 如果正则使用了标志g, 并且找到匹配, 返回的数组存放的是所有的匹配子串. 而且没有了index和input属性.
    return path.match(DIRNAME_RE)[0]
}

// 对一个路径进行规范化. 例如:
// realpath("http://test.com/a//./b/../c") 得到 "http://test.com/a/c"
function realpath(path) {
    // 将斜杠点斜杠替换为斜杠, 对当前路径的表述进行规范化. 如:
    // /a/b/./c/./d 成为 /a/b/c/d
    path = path.replace(DOT_RE, "/")
    // 迭代地将斜杠-非斜杠字符-斜杠-点点-斜杠 替换成斜杠, 例如:
    // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
    while (path.match(DOUBLE_DOT_RE)) {
        path = path.replace(DOUBLE_DOT_RE, "/")
    }
    return path
}

// 将ID正常化, 如:
// normalize("path/to/a") 变为 "path/to/a.js"
// 注意: 使用substring要比逆向slice和正则快.
function normalize(path) {
    // 最后一个字符的index.
    var last = path.length -1
    // 最后一个字符
    var lastC = path.charAt(last)
    // 如果uri中包含有井号, 直接取井号前的字符串
    if (lastC === "#") {
        // NOTE: 使用substring(i, j)取段包括位置i,但不包括位置j.
        return path.substring(0, last)
    }
    // 如果path已经是点js结尾, 或者含有问号, 或者点css结尾, 或者以斜杠结尾.
    // 直接返回path, 否则的话, 加上点js后返回.
    return (path.substring(last - 2) === ".js" ||
        path.indexOf("?") > 0 ||
        path.substring(last - 3) === ".css" ||
        lastC === "/") ? path: path + ".js"
}

// [^/:]+ 表示一个或多个非斜杠非冒号的字符.
// \/.+ 表示斜杠加一或多个字符
// 全部的正则表达式表示以一个或多个非斜杠非冒号的字符打头, 以斜杠加一或多个字符结尾. 例如:
// abc/def/asdf/asdf
var PATHS_RE = /^([^/:]+)(\/.+)$/

// 正则表达式, 全局匹配一对大括弧包含某几个字符
// [^{]+ 表示一个或多个非左大括弧的字符
var VARS_RE = /{([^{]+)}/g

// 对ID进行别名解析
function parseAlias(id) {
    // 取出data的alias属性, 这里data是全局对象seajs的一个属性
    var alias = data.alias
    // 如果data的alias属性存在并且id是已经定义好的别名, 返回别名指向的真正东西.
    // 否则直接返回传入的id
    return alias && isString(alias[id]) ? alias[id] : id
}

// 对路径id进行解析
function parsePaths(id) {
    // 取出data的paths属性, 这里data是全局对象seajs的一个属性
    var paths = data.paths
    var m
    // 如果paths存在并且传入的路径是符合正常路径的定义, 并且匹配到的第一组, 也就是路径的
    // 首段(第一个斜杠前的东西)是字符串的话, 把匹配到的第一组(也就是路径的首段, 第一个斜杠前的字符串)
    // 与匹配到的第二组连接(余下的匹配), 返回.
    // 否则的话, 直接返回传入的路径
    if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
        id = paths[m[1]] + m[2]
    }
    return id
}

// 对变量表达式进行解析
// 例如: 如果seajs.data.vars.name等于Justin, 那么,
// "My name is {name}." 解析成 "My name is Justin."
function parseVars(id) {
    // 取出data的vars属性, 这里data是全局对象seajs的一个属性
    var vars = data.vars
    // 如果vars已定义并且传入的变量表达式含有左花括弧, 将大括弧所包裹的字符串(例如是"name")替换成:
    // 1) 如果vars中有关于该字符串(例如是"name")的mapping并且值是字符串, 替换成它的mapping.
    // 2) 否则的话, 替换成传入的变量表达式, 相当于没有改变
    // 否则的话, 直接返回传入的变量表达式, 也相当于没有改变
    if (vars && id.indexOf("{") > -1) {
        // NOTE: 这里的replace方法的第二个参数如果是函数并且寻找匹配成功的话, 函数的第一个参数是匹配
        // 到的字符串, 函数的后几个参数的值分以下几种情况:
        // 1) 如果replace方法的第一个参数是字符串(例如'name')或者未分组的正则表达式的话, 函数的第二个
        // 参数是字符串或正则内容(例如'name')在replace方法的调用者(caller)的匹配到的index, 第三个参数
        // 是replace方法的调用者(caller).
        // 2) 如果replace方法的第一个参数是有分组的正则表达式的话, 函数的第二个参数是匹配到的分组对应的
        // 字符串, 第三个参数是字符串(例如'name')在replace方法的调用者(caller)的匹配到的index, 第四个
        // 参数是replace方法的调用者(caller).
        // 如果匹配未成功, 函数只有一个参数, 即replace方法的调用者(caller)自身
        id = id.replace(VARS_RE, function(m, key) {
            return isString(vars[key]) ? vars[key] : m
        })
    }
    return id
}

// 对变量uri中有map关系的字符进行解析,替换
function parseMap(uri) {
    // 取出data的map属性, 这里data是全局对象seajs的一个属性
    var map = data.map
    // 定义返回的变量ret, 初始化为传入的uri
    var ret = uri
    // 如果map存在
    if (map) {
        // 迭代map
        for (var i = 0; len = map.length; i < len; i++) {
            // 定义变量rule为当前循还取到的东西
            var rule = map[i]
            // 如果变量rule为函数, 把变量uri传给函数rule并调用, 如果调用返回结果为真值, 返回值传给变量ret; 
            //     如果调用返回结果为假值, 把变量uri传给变量ret.
            // 如果变量rule不是函数, 调用变量uri的replace方法, 把变量uri中含有等于变量rule的第一个参数的
            //     字符替换成变量rule的第二个元素, 最终将replace方法的返回值传给变量ret.
            ret = isFunction(rule) ? (rule(uri) || uri) : uri.replace(rule[0], rule[1])
            // 如果变量ret不全等于变量uri, 表明ret的值已经更新了,不再是初始值, 目的达成, 可以跳出循环
            if (ret !== uri) break
        }
    }
    // 最后返回变量ret.
    return ret
}

// 正则表达式, 表示(双斜杠开头加一个字符)或者(一个冒号加斜杠)
var ABSOLUTE_RE = /^\/\/.|:\//

// 正则表达式, 表示非贪婪匹配以零到多个字符打头, 加两斜杠加非贪婪匹配零到多个字符再加斜杠, 
// 例如: ab//c/
// 用来判断根目录
var ROOT_DIR_RE = /^.*?\/\/.*?\//

// 添加路径的基地
function addBase(id, refUri) {
    // 定义变量ret为最终要返回的东西.
    var ret
    // 传入的变量id的第一个字符
    var first = id.charAt(0)
    // 如果传入的变量id是一个绝对路径, 返回值为变量id
    if (ABSOLUTE_RE.test(id)) {
        ret = id
    }
    // 如果变量id的第一个字符为点, 表明为相对路径,
    else if (first === ".") {
        // 再判断是否传入变量refUri, 如果是的话, 取得它的所在的目录, 否则的话, 取出data(这里data是
        // 全局对象seajs的一个属性)的cwd(当前的工做目录)属性, 最后拼上变量id, 作为参数传给
        // 函数realpath, 进行规范化后赋予变量ret.
        ret = realpath((refUri ? dirname(refUri) : data.cwd) + id)
    }
    // 如果变量id的第一个字符为斜杠, 表明是根路径
    else if (first === "/") {
        // 定义变量m, 赋值为是否data的当前工作目录为根目录
        var m = data.cwd.match(ROOT_DIR_RE)
        // 如果是的话, 返回值为正则匹配到的文本连接上(去除掉第一个字符(也就是斜杠)的)变量id, 
        // 否则的话, 返回值为变量id.
        ret = m ? m[0] + id.substring(1) : id
    }
    // 其它情况的话, 返回值为data(这里data是全局对象seajs的一个属性)的属性base连接上变量id.
    else {
        ret = data.base + id
    }
    // 返回返回值
    return ret
}

// 将id转化为uri
function id2Uri(id, refUri) {
    // 如果未传入id, 或传入id未空, 假值, 直接返回空字符串.
    if (!id) return ""
    // 首先查看是否为别名, 取得对应的路径
    id = parseAlias(id)
    // 其次查看是否为路径
    id = parsePaths(id)
    // 再次查看是否含有未解决(替换)的变量表达式, 如有, 解决(替换)之.
    id = parseVars(id)
    // 再将之正常化(补上文件名后缀)
    id = normalize(id)
    // 然后再添加上路径前段的基(base), 使之成为完整路径
    var uri = addBase(id, refUri)
    // 再对有map关系的字符进行解析替换
    uri = parseMap(uri)
    // 最终返回.
    return uri
}

// 变量document的引用
var doc = document
// 变量location的引用
var loc = location
// 通过页面的路径得到当前工作目录
var cwd = dirname(loc.href)
// 页面上所有的脚本引用列表
var scripts = doc.getElementsByTagName("script")

// 定义脚本加载器, 首先考虑ID名为seajsnode的HTML元素, 如果没有, 使用最后一个脚本作为加载器.
// 推荐用户给引用seajs的脚本元素加上ID名为seajsnode
var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

// 定义加载器所在目录, 如果seajs不是通过外部引用进来的, 也就是说是行内形式, 则加载器所在目录
// 为当前工作目录.
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

// 一个帮助函数, 用于从传入的HTML标签节点中取出脚本的源文件绝对路径.
function getScriptAbsoluteSrc(node) {
    // 如果非IE6/7, 使用节点的src属性, 否则
    // 参考 http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx, 
    // 使用节点的getAttribute方法得到源文件的绝对路径.
    return node.hasAttribute ? node.src : node.getAttribute("src", 4)
}
===================================================================================
util-request.js 请求加载js脚本和css样式文件的帮助代码

// 定义DOM文档的头部引用, 使用标准方法获取, 如果不存在, 使用文档元素替代
var head = doc.getElementsByTagName("head")[0] || doc.documentElement
// 定义变量baseElement为DOM头部的base标签.
var baseElement = head.getElementsByTagName("base")[0]

// 正则, 表示不区分大小写, (以点css结尾)或者(点css加一个问号)的文本,
var IS_CSS_RE = /\.css(?:\?|$)/i
// 正则, 完全匹配字符loaded或completed或undefined
var READY_STATE_RE = /^(?:loaded|complete|undefined)$/

// 定义变量表示当前正在添加的脚本
var currentlyAddingScript
// 定义变量表示正在交互的脚本
var interactiveScript

// 在WebKit小于535.23和Firefox小于9.0的版本中不支持事件onload
// 参考:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldWebKit = (navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, "$1")) * 1 < 536

// 定义函数request, 参数分别为
// - url : 请求对象的URL地址
// - callback : 回调函数
// - charset : 字符编码
function request(url, callback, charset) {
    // 定义变量isCSS为是否传入的url为CSS
    var isCSS = IS_CSS_RE.test(url)
    // 根据isCSS判断不同来新生成为link或者script节点
    var node = doc.createElement(isCSS ? "link" : "script")
    // 如果有传入charset且为真值(truy)
    if (charset) {
        // 如果传入的charset是一个函数, 将url传给函数charset并调用, 结
        // 果赋值给变量cs; 否则, 直接赋值给变量cs
        var cs = isFunction(charset) ? charset(url) : charset
        // 如果变量cs存在.
        if (cs) {
            // 设置节点的字符编码为cs
            node.charset = cs
        }
    }
    // 调用函数addOnload, 传入参数.
    addOnload(node, callback, isCSS)
    // 如果请求是CSS文件
    if (isCSS) {
        // 设置节点的rel和href属性
        node.rel = "stylesheet"
        node.href = url
    } else {
        // 否则为JS文件, 设置节点的async属性为真, src属性为传入的url.
        node.async = true
        node.src = url
    }
    // 由于在IE6至8中某些缓存问题, JS脚本会在插入后立马执行. 因此, 使
    // 用变量currentlyAddingScript来保持当前节点的引用, 在define调用中
    // 导出url.
    currentlyAddingScript = node
    // 参见: #185 和 http://dev.jquery.com/ticket/2709
    // 如果变量baseElement存在, 将node节点插入到baseElement节点之前, 否则
    // 将node节点直接放置到DOM头部内的最后一个元素.
    baseElement ? head.insertBefore(node, baseElement) : head.appendChild(node)
    // 清空变量currentlyAddingScript的引用.
    currentlyAddingScript = null
}

// 定义函数addOnload, 参数一: node表节点, 参数二: callback表回调函数,
// 参数三: isCSS判断是否CSS文件
function addOnload(node, callback, isCSS) {
    // 当请求对象为CSS文件并且(浏览器是老的WebKit引擎或者节点中无
    // onload属性)时, 定义变量missingOnload为真, 否则为假.
    var missingOnload = isCSS && (isOldWebKit || !("onload" in node))
    // 当变量missingOnload为真时, 延时一毫秒去拉取CSS. 函数返回.
    if (missingOnload) {
        setTimeout(function() {
            pollCss(node, callback)
        }, 1) // Begin after node insertion
        return
    }
    // 设置节点的load和error和readystatechange事件的监听器.
    node.onload = node.onerror = node.onreadystatechange = function() {
        // 如果节点的加载状态是loaded或complete或undefined的话,
        if (READY_STATE_RE.test(node.readyState)) {
            // 清空已有的监听器, 防止在IE中内存泄漏
            node.onload = node.onerror = node.onreadystatechange = null
            // 如果非CSS文件(即脚本文件)并且非调试环境, 从页面文档的头
            // 部中移除该节点.
            if (!isCSS && !data.debug) {
                head.removeChild(node)
            }
            // 解除节点的引用
            node = null
            // 触发回调函数
            callback()
        }
    }
}

// 定义函数pollCss, 参数一: node表示节点, 参数二callback表示回调函数.
function pollCss(node, callback) {
    // 定义变量sheet为节点的sheet属性.
    var sheet = node.sheet
    // 判断是否已加载的标记
    var isLoaded
    // 如果是版本小于536的WebKit浏览器时,
    if (isOldWebKit) {
        // 如果节点的sheet属性存在的话,
        if (sheet) {
            // 设置标记为真, 表示已经加载.
            isLoaded = true
        }
    }
    // 如果是版本低于9.0的Firefox
    else if (sheet) {
        try {
            // 尝试判断是否存在cssRules属性, 是的话,表明已经加载过了.
            if(sheet.cssRules){
                isLoaded = true
            }
        } catch (ex) {
            // 如果发生异常, 且异常名为NS_ERROR_DOM_SECURITY_ERR的话,
            if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
                // 设置标记为真, 表明已经加载过了
                isLoaded = true
            }
        }
    }
    // 延时20毫秒去
    setTimeout(function() {
        // 如果CSS文件已加载,
        if (isLoaded) {
            // 调用回调函数, 在这调用回调函数是为了留出时间以渲染样式
            callback()
        }
        // 否则再次请求CSS文件, 直到成功
        else {
            pollCss(node, callback)
        }
    }, 20)
}

// 获取当前的脚本
function getCurrentScript() {
    // 如果正在添加脚本
    if (currentlyAddingScript) {
        // 直接返回正在添加的脚本
        return currentlyAddingScript
    }
    // 对于浏览器IE6-9, 脚本的onload事件可能不会在评估后马上发出, Kris
    // Zyp发现可以通过查询所有脚本,从中找到为interactive状态的, 即为当
    // 前的脚本. 参见: http://goo.gl/JHfFW
    // 如果交互脚本非空, 且它的readyState为interactive.
    if (interactiveScript && interactiveScript.readyState === "interactive") {
        // 直接返回该交互脚本
        return interactiveScript
    }
    // 提取出DOM中所有的脚本
    var scripts = head.getElementsByTagName("script")
    // 迭代所有脚本
    for (var i = scripts.length - 1; i >= 0; i--) {
        // 当前的脚本
        var script = scripts[i]
        // 如果当前的脚本的readyState属性为interactive
        if (script.readyState === "interactive") {
            // 设置交互脚本为当前迭代到的脚本
            interactiveScript = script
            // 返回该交互脚本
            return interactiveScript
        }
    }
}
====================================================================================
util-deps.js 依赖分析器

// 正则表达式，全局匹配，表示以下带字符「某」的多个正则片断中的某一个。
// (?:\\"|[^"]) 表示一个匹配但不获取的分组, 组为「一个反斜杠加双引号」或者
// 「非双引号的字符」。
// 某"(?:\\"|[^"])" 表示双引号包裹的一个非捕获分组
// 某'(?:\\'|[^'])*' 表示单引号包裹的一个非捕获分组
// 某\/\*[\S\s]*?\*\/ 表示「斜杠」加「星号」加「非贪婪零到多个字符」加「星号」加
// 斜杠，例如： /*abc*/
// (?:\\\/|[^\/\r\n]) 表示一个非获取分组，组为「反斜杠加斜杠」或者「非斜
// 杠非换行符」
// 某\/(?:\\\/|[^\/\r\n])+\/(?=[^\/]) 表示「斜杠」加「一到多个非获取分组」加
// 「斜杠」加「非斜杠」
// 某\/\/.* 表示两「斜杠」加「零到多个字符」。
// 某\.\s*require 表示「点」加零到多个「空白符」加字符「require」。
// require\s*\(\s*(["'])(.+?)\1\s*\) 该正则表示require表达式。例如：
// require("abc")，或者require('edf')
// 某(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\) 表示一个非获取分组，
// 组为『字符「^」或者非「美元字符」』，加一个『单词边界』加一个『require表达式』。
var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
// 正则表达式, 表示两反斜杠, 全局匹配
var SLASH_RE = /\\\\/g

// 定义解析依赖函数, 传入的参数为代码字符串。
function parseDependencies(code) {
    // 定义最终将返回的东西，为数组。
    var ret = []
    // 去掉两个反斜杠
    code.replace(SLASH_RE, "")
    // 因为这里replace方法的第一个参数是非获取匹配带分组的正则表达式, 所以
    // replace方法的第二个参数(即匿名函数)的第一个参数m是匹配
    // 到的字符串，函数的第二个参数m1是字符串在replace方法的调用者
    // (caller)的匹配到的index。 函数的第三个参数是操作的StringObject，
    // 即replace方法的调用者(caller)。
        .replace(REQUIRE_RE, function(m, m1, m2) {
            // 如果匹配成功，且操作的StringObject为真值。
            if (m2) {
                // 将其加入到返回数组ret。
                ret.push(m2)
            }
        })
    // 返回数组。
    return ret
}
============================================================================
module.js 模块加载器的核心代码

// 设置全局对象seajs的cache属性为空对象。并赋予变量cachedMods，表示缓
// 存的模块。
var cachedMods = seajs.cache = {}
// 一个匿名的元
var anonymousMeta
// 正在获取的模块列表变量，初始化为空对象。
var fetchingList = {}
// 已获取的模块列表变量，初始化为空对象。
var fetchedList = {}
// 回调列表，初始化为空对象。
var callbackList = {}
// 模块的六种状态
var STATUS = Module.STATUS = {
    // 状态一：模块正在获取中
    FETCHING: 1,
    // 状态二：模块的元数据已存入缓存中
    SAVED: 2,
    // 状态三：模块的依赖正在加载中
    LOADING: 3,
    // 状态四：模块加载完成，准备开始执行
    LOADED: 4,
    // 状态五：模块正在执行中
    EXECUTING: 5,
    // 状态六：模块执行完成，可以对外提供模块接口了。
    EXECUTED: 6
}
// 模块的构造函数，参数一为模块的URI，参数二为模块的依赖
function Module(uri, deps) {
    this.uri = uri
    // 如果未传入依赖，默认为空数组
    this.dependencies = deps || []
    this.exports = null
    // 模块的初始状态为零
    this.status = 0
    // 依赖该模块的其他模块
    this._waitings = {}
    // 未加载的依赖，初始为没有。
    this._remain = 0
}
// 模块的原型方法resolve，用于剖析模块的依赖。
Module.prototype.resolve = function() {
    // 当前模块
    var mod = this
    // 当前模块的所有依赖
    var ids = mod.dependencies
    // 定义所有依赖的URI数组，初始为空数组。
    var uris = []
    // 迭代所有依赖，调用模块的resolve方法获取到所有依赖的URI。
    for (var i = 0, len = ids.length; i < len; i++) {
        uris[i] = Module.resolve(ids[i], mod.uri)
    }
    // 最终返回
    return uris
}
// 模块的原型方法load，用于加载模块的所有依赖，然后在完成后触发onload
// 事件句柄。
Module.prototype.load = function() {
    // 当前模块
    var mod = this
    // 如果当前模块正在加载中，直接返回等待加载完成。
    if (mod.status >= STATUS.LOADING) {
        return
    }
    // 设置当前模块的状态为加载中。
    mod.status = STATUS.LOADING
    // 发出load事件以供插件(如combo插件)使用，传入的参数为当前模块的所有依赖。
    var uris = mod.resolve()
    emit("load", uris)
    // 当前模块未加载的依赖，亦需要加载的依赖的个数
    var len = mod._remain = uris.length
    // 当前模块的某一个依赖
    var m
    // 迭代需要加载的依赖
    for (var i = 0; i < len; i++) {
        // 迭代中当前的依赖
        m = Module.get(uris[i])
        // 若当前依赖还未加载完成
        if (m.status < STATUS.LOADED) {
            // 未知??? TODO
            m._waitings[mod.uri] = (m._waitings[mod.uri] || 0) + 1
        }
        // 否则，当前模块的需要加载的依赖数减一。
        else {
            mod._remain--
        }
    }
    // 如果当前模块的所有依赖已全部加载完成，调用模块的onload方法，然后返
    // 回。
    if (mod._remain === 0) {
        mod.onload()
        return
    }
    // 并行加载
    var requestCache = {}
    for (i = 0; i < len; i++) {
        // 从缓存的模块列表中获取某个依赖
        m = cachedMods[uris[i]]
        // 若该依赖还未开始获取，调用其fetch方法
        if (m.status < STATUS.FETCHING) {
            m.fetch(requestCache)
        }
        // 不然若其元数据已存入缓存中，调用其load方法。
        else if (m.status === STATUS.SAVED) {
            m.load()
        }
    }
    // 最后发出所有的请求，以规避在IE6-9中的缓存bug。参见Issues#808
    for (var requestUri in requestCache) {
        if (requestCache.hasOwnProperty(requestUri)) {
            requestCache[requestUri]()
        }
    }
}
// 模块加载完成后调用的方法。
Module.prototype.onload = function() {
    // 当前模块
    var mod = this
    // 设置其状态为已加载
    mod.status = STATUS.LOADED
    // 如果该模块有回调函数，调用之。
    if (mod.callback) {
        mod.callback()
    }
    // 正在等待当前模块完成的其他模块。
    var waitings = mod._waitings
    // 定义某个uri，某个模块，用于迭代。
    var uri, m
    // 迭代这些模块，依次调用等待当前模块完成的其他模块的加载完成函数onload。
    for (uri in waitings) {
        if (waitings.hasOwnProperty(uri)) {
            // 从缓存中取出迭代中当前的模块
            m = cachedMods[uri]
            m._remain -= waitings[uri]
            // 如果迭代中的当前模块的所有依赖都已加载，调用其onload方法。
            if (m._remain === 0) {
                m.onload()
            }
        }
    }
    // 内存释放
    delete mod._waitings
    delete mod._remain
}
// 模块的原型方法fetch，用于模块的获取。
Module.prototype.fetch = function(requestCache) {
    // 当前模块
    var mod = this
    // 当前模块的URI
    var uri = mod.uri
    // 更新模块的状态为获取中
    mod.status = STATUS.FETCHING
    // 准备发出事件的携带数据
    var emitData = { uri: uri }
    // 向外发出事件fetch以供插件(如combo插件)使用
    emit("fetch", emitData)
    // 为何需要使用『||』来判断emitData的requestUri属性空否?  参见
一个代码细节问题

    var requestUri = emitData.requestUri || uri
    // 如果是空的URI或非CMD模块，或者URI存在于已取列表中，调用模块的加
    // 载方法并返回。
    if (!requestUri || fetchedList[requestUri]) {
        mod.load()
        return
    }
    // 若URI存在于正在获取中列表中，将模块添加至其对应的回调函数列表中并返回。
    if (fetchingList[requestUri]) {
        callbackList[requestUri].push(mod)
        return
    }
    // 设置正在获取中列表中URI对应的为真。
    fetchingList[requestUri] = true
    // 设置回调函数列表中URI对应的为当前模块的一个数组。
    callbackList[requestUri] = [mod]
    // 发出request事件，传递参数。
    emit("request", emitData = {
        uri: uri,
        requestUri: requestUri,
        onRequest: onRequest,
        charset: data.charset
    })
    // 若请求未完成，
    if (!emitData.requested) {
        // 且传入的参数requestCache非空，将方法sendRequest赋予缓存中的
        // URI对应的值。
        // 若requestCache为空，直接调用方法sendRequest。
        requestCache ? requestCache[emitData.requestUri] = sendRequest : sendRequest()
    }
    // 定义方法sendRequest。
    function sendRequest() {
        // 调用方法request，传入参数。参数一为URI，参数二为回调函数，
        // 参数三为子符编码集。
        request(emitData.requestUri, emitData.onRequest, emitData.charset)
    }
    // 定义请求的回调函数。
    function onRequest() {
        // 移除掉获取中列表中的URI对应的引用。
        delete fetchingList[requestUri]
        // 设置已获取列表中URI对应的值为真。
        fetchedList[requestUri] = true
        // 若匿名元非空，在模块中把它保存下来，并且清空匿名元。
        if (anonymousMeta) {
            Module.save(uri, anonymousMeta)
            anonymousMeta = null
        }
        // 清空回调列表中URI对应的所有模块，对它们进行迭代，依次调用其load方法。
        var m, mods = callbackList[requestUri]
        delete callbackList[requestUri]
        while ((m = mods.shift())) m.load()
    }
}
// 模块的原型方法exec，用于模块的执行。
Module.prototype.exec = function() {
    // 当前模块
    var mod = this
    // 若模块正在或已经执行完毕，直接返回模块的输出以防止重复、循环调用。
    if (mod.status >= STATUS.EXECUTING) {
        return mod.exports
    }
    // 设置模块的状态为正在执行中。
    mod.status = STATUS.EXECUTING
    var uri = mod.uri
    // 定义require方法。
    function require(id) {
        return Module.get(require.resolve(id)).exec()
    }
    // 添加require的resolve方法，用于剖析模块的ID。其参数为ID。
    require.resolve = function(id) {
        return Module.resolve(id, uri)
    }
    // 添加require的async方法，用于异步添加依赖。参数一为依赖的ID们，
    // 参数二为回调函数。
    require.async = function(ids, callback) {
        // 给URI加上异步和不重复的标识
        Module.use(ids, callback, uri + "_async_" + cid())
        return require
    }
    // 模块执行的工厂
    var factory = mod.factory
    // 若工厂为函数，传入参数『参数一为变量require，参数二为模块的
    // exports属性，参数三为该模块』调用之并将返回结果赋予变量exports，否则直接将其赋予变量exports。
    var exports = isFunction(factory) ? factory(require, mod.exports = {}, mod) : factory
    // 若变量exports未定义，将模块的exports属性赋给它。
    if (exports === undefined) {
        exports = mod.exports
    }
    // 若变量exports为null，且不是加载CSS文件，发出error事件，携带的数据为当前模块。
    if (exports === null && !IS_CSS_RE.test(uri)) {
        emit("error", mod)
    }
    // 去除模块的工厂引用以防止内存泄漏。
    delete mod.factory
    // 设置模块的对外输出的东西。
    mod.exports = exports
    // 设置模块的状态为执行完成。
    mod.status = STATUS.EXECUTED
    // 发出exec事件，携带的数据为当前模块。
    emit("exec", mod)
    // 返回模块最终暴露给外面的东西。
    return exports
}
// 模块的resolve方法，用于将模块的ID剖析成对应的URI。
Module.resolve = function(id, refUri) {
    // 首先定义好事件的携带数据。其中有ID和参照URI。
    var emitData = { id: id, refUri: refUri }
    // 发出resolve事件
    emit("resolve", emitData)
    // 若resolve事件的监听器设置了URI，将其返回。
    // 否则，使用方法id2Uri将ID剖析成URI。
    return emitData.uri || id2Uri(emitData.id, refUri)
}
// 模块的define方法，用于模块的定义。
Module.define = function(id, deps, factory) {
    // 参数的个数
    var argsLen = arguments.length
    // 若仅一个参数，暗示仅传入了模块的制作方法，如同：define(factory)。
    if (argsLen === 1) {
        factory = id
        id = undefined
    }
    // 若有两个参数，
    else if (argsLen === 2) {
        factory = deps
        // 且传入的第一个参数为数组，暗示传入了模块的依赖和制作方法。
        // 如同：define(deps, factory)。
        if (isArray(id)) {
            deps = id
            id = undefined
        }
        // 否则暗示传入了模块的ID和制作方法。如同：define(id, factory)
        else {
            deps = undefined
        }
    }
    // 若变量deps非数组且变量factory非函数，即define(id, factory)，设定模块的依赖。
    if (!isArray(deps) && isFunction(factory)) {
        deps = parseDependencies(factory.toString())
    }
    // 定义一个数据元
    var meta = {
        id: id,
        uri: Module.resolve(id),
        deps: deps,
        factory: factory
    }
    // 尝试在IE6-9中从匿名模块中引导出URI。
    if (!meta.uri && doc.attachEvent) {
        var script = getCurrentScript()
        if (script) {
            meta.uri = script.src
        }
        // 注意：如果上面的方法『从ID中导出URI』失败了，会降级使用
        // onload事件来取得URI。
    }
    // 发出define事件供非缓存的插件、seajs的node版本中使用。
    emit("define", meta)
    // 若数据元中的URI为空，将数据元通过URI标识存入模块中。
    // 否则，设置该匿名元为当前的数据元。
    meta.uri ? Module.save(meta.uri, meta) : anonymousMeta = meta
}
// 模块的save方法，用于将元数据保存至缓存的模块中。
Module.save = function(uri, meta) {
    // 通过URI拿到模块。
    var mod = Module.get(uri)
    // 若模块还未存入缓存中，
    if (mod.status < STATUS.SAVED) {
        // 设置模块的ID为数据元的ID，若无，使用URI替代。
        mod.id = meta.id || uri
        // 设置模块的所有依赖为数据元中的依赖，若无，默认为空数组。
        mod.dependencies = meta.deps || []
        // 设置模块的制作方法为数据元中的制作方法。
        mod.factory = meta.factory
        // 设置模块的状态为已保存至缓存中。
        mod.status = STATUS.SAVED
    }
}
// 模块的get方法，用于已有模块的取得或者新模块的创建。
Module.get = function(uri, deps) {
    // 用URI从缓存中取出模块，若无，使用URI和依赖新建一个模块。
    return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}
// 模块的use方法，用于加载匿名模块。参数一为依赖的模块，参数二为回调函
// 数，参数三为模块的URI。
Module.use = function(ids, callback, uri) {
    // 首先获取模块
    var mod = Module.get(uri, isArray(ids) ? ids : [ids])
    // 添加模块的回调函数。
    mod.callback = function() {
        var exports = []
        // 模块的所有依赖
        var uris = mod.resolve()
        // 迭代所有依赖，依次调用其执行方法，结果存入变量exports中。
        for (var i = 0, len = uris.length; i < len; i++) {
            exports[i] = cachedMods[uris[i]].exec()
        }
        // 若传入了回调函数，调用之，传入参数为全局变量global和变量exports。
        if (callback) {
            callback.apply(global, exports)
        }
        // 移除模块上的回调函数以释放内存。
        delete mod.callback
    }
    // 最后调用模块的load方法。
    mod.load()
}
// 模块的preload方法，用于在加载其它模块之前先加载上『预加载模块』，参
// 数为一回调函数。
Module.preload = function(callback) {
    // 从全局定义中拿到需要预加载的模块。
    var preloadMods = data.preload
    // 预加载模块的个数。
    var len = preloadMods.length
    // 如果有预加载模块，
    if (len) {
        // 加载所有的『预加载模块』
        Module.use(preloadMods, function() {
            // 移除已加载的『预加载模块』
            preloadMods.splice(0, len)
            // 递归加载『预加载模块』的『预加载模块』。
            Module.preload(callback)
        }, data.cwd + "_preload_" + cid())
    }
    // 否则，直接调用回调函数。
    else {
        callback()
    }
}
// 对外的接口
// 全局对象seajs的use函数，用于加载上所有的依赖IDs。参数一为所有的依赖，
// 参数二为回调函数。
seajs.use = function(ids, callback) {
    // 加载上所有的预加载模块。
    Module.preload(function() {
        // 使用预加载模块的回调函数来加载所有的依赖IDs。
        Module.use(ids, callback, data.cwd + "_use_" + cid())
    })
    // 最后返回全局变量seajs以方便链式调用。
    return seajs
}
// 模块的定义方法的cmd属性。
Module.define.cmd = {}
// 把模块的定义方法赋予全局变量global的define属性以方便外部调用。
global.define = Module.define

// 开发人员专用
// 将模块的引用赋给全局变量seajs的Module属性。
seajs.Module = Module
// 将已获取模块的列表引用赋给全局变量data的fetchedList属性。
data.fetchedList = fetchedList
// 将方法cid传递给全局变量data的cid属性。
data.cid = cid
// 将方法id2Uri赋予全局变量seajs的resolve属性以方便外部调用。
seajs.resolve = id2Uri
// 添加全局变量seajs的require方法，用于通过ID来加载模块并返回该模块的
// 对外输出(暴露)的东西。
seajs.require = function(id) {
    // 使用『||』来预防找不到模块或模块为空的情况。
    return (cachedMods[Module.resolve(id)] || {}).exports
}
=====================================================================================
config.js 加载器的配置

// 正则，表示以一到多个的(非贪婪)字符加一个『斜杠』打头，后面跟着两个可有可无的
// 问号，再跟着一到多个字符串『seajs/』。
// (.+?)可以用来预防贪婪匹配。
var BASE_RE = /^(.+?\/)(\?\?)?(seajs\/)+/
// 添加全局变量data的base属性，其值为加载器目录的根路径或者直接为加载
// 器的目录。用于方法id2Uri的解析。例如：如果加载器的URI是
// 『http://test.com/libs/seajs/[??][seajs/1.2.3/]sea.js』，
// 则基URI值为『http://test.com/libs/』。
data.base = (loaderDir.match(BASE_RE) || ["", loaderDir])[1]
// 加载器的所在目录。
data.dir = loaderDir
// 当前工作目录
data.cwd = cwd
// 文件请求的字符编码
data.charset = "utf-8"
// 预加载的模块，亦插件。
data.preload = (function() {
    // 预定义好最终要返回的插件数组为空。
    var plugins = []
    // 将字符串『seajs-xxx』转换为『seajs-xxx=1』。
    // 而我们在HTML文档的URI或Cookie中使用字符串『seajs-xxx=1』来预加
    // 载插件『seajs-xxx』。
    var str = loc.search.replace(/(seajs-\w+)(&|$)/g, "$1=1$2")
    // 添加上cookie字符串。
    str += " " + doc.cookie
    // 排除掉『seajs-xxx=0』的情况，把『seajs-xxx=1』的模块(插件)添入
    // 到最终要返回的插件数组中。
    str.replace(/(seajs-\w+)=1/g, function(m, name) {
        plugins.push(name)
    })
    // 最终返回插件数组。
    return plugins
})()

// data.alias - 一个容纳模块ID的别名的对象。
// data.paths - 一个容纳模块ID中的路径简谓的对象。
// data.vars - 模块ID中的{xxx}变量。
// data.map - 一个容纳模块URI映射关系的数组。
// data.debug - 调试模式。默认值为假，即非调试模式。

// 定义seajs的config方法，传入的参数为能配置的数据configData。
seajs.config = function(configData) {
    // 对传入的配置数据所有属性迭代，『key』为属性名。
    for (var key in configData) {
        // 现有的配置值从传入的配置数据中取出。
        var curr = configData[key]
        // 原有的配置值从全局变量data中取出。
        var prev = data[key]
        // 若原配置值存在且为对象，再对该对象(例如：alias，vars)进行合并。
        if (prev && isObject(prev)) {
            for (var k in curr) {
                prev[k] = curr[k]
            }
        }
        // 否则将所有新的配置定制后存入全局对象data中。
        else {
            // 若原配置值为数组，例如：map，preload，新旧配置叠加作为
            // 新的配置。
            if (isArray(prev)) {
                curr = prev.concat(curr)
            }
            // 若配置名为『base』，
            else if (key === "base") {
                // 确保base配置以斜杠结尾。
                (curr.slice(-1) === "/") || (curr += "/")
                // 确保『data.base』为绝对路径。
                curr = addBase(curr)
            }
            // 将所有新的配置存入全局对象data中。
            data[key] = curr
        }
    }
    // 发出config事件，携带数据为传入的configData。
    emit("config", configData)
    // 返回全局变量seajs。
    return seajs
}
outro.js

})(this);
