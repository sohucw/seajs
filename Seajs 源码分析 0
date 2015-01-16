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
