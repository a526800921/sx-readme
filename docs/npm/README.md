---
sidebarDepth: 2
---

::: tip
npm包均为公司内部npm仓库所有

npm仓库源: http://xxx
:::

::: danger 重要提示
如果依赖有更新，请在依赖所在的 README.md 文件下进行更新的描述。
:::

## stat

> 具体用法参考项目地址：client-stat

### 开始

``` js
import Stat from 'stat'
import { /* VuePlugin, WatchRoutePlugin, NativePlugin, NativePlugin_3, */ H5_format } from 'stat/plugins'
// import Vue from 'vue'
// import hostSdk from 'host-sdk'
// import WatchRoute from 'watch-route'

const stat = new Stat({
    report(datas) {
        console.log('埋点上报: ', datas)
    },
	plugins: [
        // new VuePlugin(Vue),
        // new WatchRoutePlugin(WatchRoute),
		// new NativePlugin(hostSdk),
		// new NativePlugin_3(hostSdk), // 要求 host-sdk 3.x 版本及以上
        new H5_format(),
    ]
})
```

### 版本迭代

* 在 1.x - 2.x 版本中，强耦合于vue项目，功能移植困难
* 在 3.x 版本中，已完成轻耦合，但使用方式欠妥，且参数配置过多
* 在 4.x 版本中，已完成完全解耦，以插件的形式注入需要的模块

### 需求场景

* 在纯H5中使用
* 在交互式webview中使用
* 与vue集成

### 初步设想

* 需要适用于多场景
* 需要可读性
* 需要可扩展
* 实现解耦

...

综上，初步以 webpack 的 插件(plugins) 形式进行编写并使用。
插件的形式能够足够好的支持

* 多场景(即一个插件针对一个场景)
* 高扩展(可自编写适用当前场景插件)
* 增强可读性(即一个插件代表一个功能模块，通过组合使用插件可以达到需要的效果)
* 与项目解耦(使用对应插件引入对应依赖)

### 代码实现

* 项目使用 Symbol 作为私有变量名(其实没必要)
* 使用 get
* 使用 static
* 围绕当前路由 pathname 作为 key 存储上报过的记录，来做上报限制

首先初始化的时候需要将插件导入到插件列表，
然后完成自身的初始化

```js
// 初始化插件，将当前stat实例传入插件使用
plugins.forEach(plugin => {
    if (isFn(plugin.apply)) plugin.apply.call(plugin, this)
    else if (isFn(plugin)) plugin.call(null, this)
})

// 然后初始化自身所需操作
this[init]()
```

然后确认到，埋点共有三种类型，一种是页面类型的埋点，一种是节点展示类型的埋点，还有就是点击类型，
于是可以声明三个方法

```js
// 页面或者主动埋点
pageReport(params) { ... }
// 节点展示的被动埋点
nodeReport(params) { ... }
// 点击埋点
// 点击类型其实可以更改action参数来使用pageReport，但是为了更加直观，于是单独列出
clickReport(params) { ... }
```

这时候，由于节点的展示埋点属于被动埋点，所以需要在节点渲染之后把节点dom以及节点的埋点参数添加到一个节点数组中，
然后在滚动的时候判断节点的位置，如果在窗口中则进行上报(这里添加的当前页面key的所有节点都会查询一次，查询位置会引起重排，如果节点过多可能会有性能问题，可参考无限滚动处理)，
那么在这时候，就需要好几个方法

```js
// 添加节点
// 这里的id是让stat知道节点是新增还是更新，并且方便移除
addNode(el, { id, ...params }) { ... }
// 移除节点
removeNode(id) { ... }
// 添加节点进入数组
setNodeList(id, { el, ...params }) { ... }
// 获取当前页面key的节点数组
getNodeList() { ... }
// 添加节点事件列表
// 使用事件时可以无需再次手动的调用 clickReport
// 由节点 click 事件代替完成
setEventList(id, event) { ... }
// 获取当前页面key的节点事件列表
getEventList() { ... }
```

这时候上报的途径已经有了，那么就需要上报的方法

```js
// 上报需要一个原始的数据
getBaseData(params) { ... }
// 初始数据基本是无法用作上报的，所以这时候需要一个数据格式化的操作
// 这里由插件来制定上报所需的数据格式(例如 H5_format, native 插件)
// 内部会走一个数组的依次执行并传递执行结果的逻辑，类似管道符的操作，故这里可能会存在执行顺序问题
formatData(datas) { ... }
// 在拿到格式化后的数据，就可以进行上报了
// 在这个入口中，可以处理缓存，处理数据，当作一个控制器来使用
report(datas) { ... }
```

其实到这个时候，从数据采集到上报基本就完成了，剩下的只是一些细节上的补充和各个环境插件的编写

* VuePlugin 插件

```js
// 该插件仅提供 v-stat 指令，无其他依赖或操作
Vue.directive('stat', {
    inserted: addNode,
    componentUpdated: addNode,
    unbind: removeNode,
})
```

* WatchRoutePlugin 插件

```js
// 该插件提供 parent, pageFrom 类型参数
// 对格式化顺序有要求(更改的是源数据)，需要放在前面
// 这里的 listen 是 stat 实例的方法，用作监听路由改变
stat.listen('/', (data, params) => {
    ...
    return {
        parentPage: getPageName(parent.href || ''),
        parentParams: { ...parent.query },
    }
})
        
stat.pipe(datas => {
    ...
    datas.forEach(data => !data.pageFrom && (data.pageFrom = pageFrom))
    return datas
})
```

* NativePlugin NativePlugin_3 插件

```js
// 这个插件处理的东西较多：设置上报方法、更改数据格式、页面end埋点、跳转客户端埋点
// 这里就不展示太多了，具体见 stat 源码
stat.pipe(format)
```

* H5_format 插件

```js
// 这里就仅仅是格式化h5下面的埋点的数据格式
stat.pipe(datas => [format(this.options, datas)])
```

> 这里讲一下节点展示逻辑

```js
ids.forEach(id => {
    // 已上传过
    if (history[path][id]) return delete nodes[id]

    const { el, unView, params } = nodes[id]
    if (unView) return
    if (!el.getBoundingClientRect) return

    // 这里主要通过 getBoundingClientRect 方法获取到节点所在窗口的位置 
    const { left, top } = el.getBoundingClientRect()
    // 然后获取到节点的宽高
    const { offsetWidth, offsetHeight } = el

    // 再以节点的高度或宽度的 1/3 在窗口内时，即计入上报标准进行上报
    // 并将上上报过的节点id进行缓存，防止当前页面的二次上报(无效数据)
    if (
        // 在窗口内
        left >= 0 - offsetWidth / 3 * 2 &&
        left <= innerWidth - offsetWidth / 3 &&
        top >= 0 - offsetHeight / 3 * 2 &&
        top <= innerHeight - offsetHeight / 3
    ) {
        reportList.push(params)
        delete nodes[id]
        history[path][id] = true
    }
})
```

### 结语

在一个插件的初期编写是比较困难的，当时并没有多端的需求，导致了与vue项目的重度耦合，在第二个项目需要时移植特别困难，
很多逻辑都依赖于vue及vue-router，但是重度依赖的原因是想通过一套逻辑来解决复制粘贴(每个页面都有view，且parent的处理比较麻烦)。
这里由自己实现的watch-route来代替vue-router，这时候其实对vue的耦合已经不多了，再通过插件的形式引入时，就已经完成对vue的解耦了，现在可以在各个h5项目上面使用。
一个平台对应一个插件，插件编写也简单，不需要耗费太多时间，倘若又新增了一个平台，现在也只需要新增一个对应的插件，甚至不需要新增(快应用)。





## watch-route

> 具体用法参考项目地址：watch-route

### 开始

```js
import WatchRoute from 'watch-route'

const watchRoute = new WatchRoute(options)
```

### 版本迭代

* 1.x 基本定型
* 2.x 添加对stat插件的兼容且为了避免线上包的自动更新

### 需求场景

* 为了与 vue-router 解耦的产物

### 初步设想

该依赖是为了vue-router解耦而存在，可用在所有h5项目，
那么该监听就应该是纯被动监听，不应有主动交互，在这个依赖中其他角色仅能进行获取数据操作。

### 代码实现

既然是作为一个只读的路由依赖，那么该依赖就需要提供足够完整的数据，
那么这里有几个基础的功能

```js
// 页面栈，这里的 getStack 是取 session 内存储的 stack，防止刷新页面时页面栈丢失
this._pageStack = getStack()
// 页面链(用户行为路线)， getChain 同上
this._chain = getChain()
// 简化获取当前页面信息
this.currentPage
// 简化获取parent页面
this.parentPage
// 用于跳转时的钩子
afterEach(callback) { ... }
```

基础功能有了，那么就剩下如何监听了

```js
// 由于 window.location 不可代理，就没有进行代理
// 故在使用 location 进行跳转或返回时，可能会产生误差

// 好在 history 可以进行代理
const { back, forward, go, pushState, replaceState } = window.History.prototype
// 这里的 -1 1 0 是指对页面栈层级的影响，1 即为推入一层页面栈，0 为刷新顶层页面栈， -1 为删除顶层页面栈
const kv = {
    back: [back, -1],
    forward: [forward, 1],
    pushState: [pushState, 1],
    replaceState: [replaceState, 0],
    go: [go, 0],
}

Object.keys(kv).forEach(item => {
    window.History.prototype[item] = function () {
        ...
```

在主动行为的代理完成后，需要监听浏览器的行为(前进、返回)

```js
// 这里监听浏览器跳转有两个方式
// 一个是监听 popstate
// 一个是监听 hashchange
// 但是在这里发现 popstate 也能监听到 hashchange 能监听的事件(hash改变)
// 显然 popstate 更加完善，便使用 popstate 作为主要监听对象
window.addEventListener('popstate', e => {
    ...
```

具体细节代码较多，可以直接看源码。这里主要是通过代理及监听来完成自主的页面栈功能(即页面栈、页面链都在这里面进行进栈出栈操作)，
除了一直用 location 进行跳转且 前进后退前进后退，不然是可以保证页面栈的正确性的。
且这类跳转为极少数，故该依赖是可用的。

### 结语

该依赖有种为了写而写的意思，但是写出来确实也能实现与vue的解耦，可以使用在所有H5中，不存在第三方依赖，
自身就是第三方依赖的依赖，为了更好的完成埋点需求而存在。

该依赖没有用什么好的方式，就是最纯粹的代理拦截，只是内部需要处理的细节比较多，比如在主动跳转的时候，监听的popstate也会触发，
这时候就需要做一个阻断。还要处理刷新页面的时候，这时候相当于是刷新顶层栈，而非推入栈，等等其他细节。






## host-sdk

> 具体用法参考项目地址：host-sdk

### 开始

```js
import Sdk from 'host-sdk'

Sdk.partyCall(name, ...arg)
  .then(res => { ... }) // 调用 成功 回调
  .catch(err => { ... }) // 调用 失败/取消 的回调
```

### 版本迭代

* 1.x - 2.x 版本中，用法无区别，仅新增新的交互方法
* 3.x 使用 typescript 进行重构，改善易用性

### 需求场景

与客户端交互，由于老版本使用方式太麻烦，故进行了重构

### 初步设想

* 增强易用性
* 改善可读性

由于历史原因，客户端在调用sdk回调的时候，并没有告诉h5是哪个方法(key)的回调，
并且有的方法没有回调，最开始想的是，既然客户端没有返回 key 值，那就从返回的值里面，
通过值的组成格式，来判断是哪一个方法的回调，这种方式实现起来需要去调客户端的所有方法来确认返回值格式，
需要确认哪些方法是否有返回值，得花点时间。但是在客户端无法更改的情况下，只能这么去做了。


### 代码实现

首先需要判断所在平台，进行平台的初始化(初始化交互逻辑)，
初始化完成后，将各个平台的回调统一到 window.host_sdk 下的回调执行

```js
// 平台初始化
if (isApple) iosInit()
else if (isKyy) kyyInit()
else androidInit()
```

于是这里就有了一个客户端触发回调的入口

```js
// 操作成功后的回调
successCallback: (...res) => SDK.runSuccessCallback(...res)
```

入口有了之后，就可以从开始的想法入手，
以前为了回调的准确性，在某些时候只能一个一个进行调用，否则之前回调未完成时，会被后面的回调覆盖，
那么这时候就可以把调用的回调推入一个回调队列，等待回调的执行

```js
SDK.addCallback(call: Methodable)
```

现在已经有了回调队列及客户端回调入口，在只有单个回调的时候，已经能够完成客户端对H5的回调交互。
在同时有多个回调的时候，就可以使用返回值匹配来进行辨识回调(一种值对应一个方法，一个方法对应一个回调)。
在匹配完成后，就可以拿到返回值对应的方法的回调了。

```js
// 这里提供一个方法声明的demo
// 获取客户端详情
export const getInfo: Methodable = {
    successMatch: ['version'],
    handle: (): void => {

        if (isApple) {
            window.ios_hostsdk.callHandler('getInfo')
        } else {
            window.androidCallHandler('getInfo')
        }
    }
}

// 这里是匹配值的方式
switch (typeof res) {
    // 当值为字符串的时候，匹配字符串中的值是否包含设定的值，如果有，则证明该值是对应方法的回调
    case 'string': return callbacks.findIndex(call => call.match.findIndex(key => res.indexOf(key) > -1) > -1)
    // 当值为对象的时候，匹配对象下面的键值(key)，如果都匹配成功，则证明该值是对应方法的回调
    case 'object': return callbacks.findIndex(call => !!call.match.length && call.match.every(key => res[key] !== void 0))
    // 其他类型则匹配没有 match 匹配列表的方法对应的回调
    default: return callbacks.findIndex(call => !call.match.length)
}
```

### 结语

在这个依赖中，比较重要的是解决多方法同时调用并且能够准确的拿到对应回调，
以及对应方法必须正确的填写匹配(match)所需要的字段，达到正确匹配的效果。
当时在编写快应用环境的时候，其实可以与客户端区分开来，
但是当时没有考虑到(当时想的是跟客户端保持一致，快应用的H5可能会给客户端使用，结果到现在就没有与客户端共用过)，
导致现在快应用在使用H5页面时，回调还是会有问题(请求需要附带公参，公参需要进行交互获取)，
说明该依赖的匹配规则还有待优化。






## error-report

> 具体用法参考项目地址：error-report

### 开始

```js
<script type="text/javascript" src="https://c.sxyj.net/webresource/plugins/error-report.js"></script>

var errorReport = new ErrorReport({
    name: '<项目名称>',
    url: 'http://xxx',
});

// 如果在vue环境中使用，由于vue内部有错误捕获机制，需要手动绑定一次
// Vue.config.errorHandler = (...err) => console.error(...err) || errorReport.report(...err, { target: 'vue' })
```

### 版本迭代

* 1.x 基础版本
* 2.x 使用 class 进行重构，新增黑名单，核心逻辑并无大改

### 需求场景

在测试环境中，报错都能够及时的看到并解决，但是在生产环境中，
报错信息往往不能及时的捕获并处理，所以需要一个错误监控，来解决生产环境的报错。

### 初步设想

能够准确的监听到各类错误并及时的上报

### 代码实现

在写代码之前，需要确认都有哪些类型错误：

* 节点错误(渲染错误？src错误？)
* 事件错误(其实就是函数执行错误，逻辑错误)
* http请求错误

确认了这三大类型(或许有更多？)错误之后，就可以先创建三个js文件(单一职责) domError eventError httpError，
在 domError 和 eventError 中，都只需要添加监听即可 

```js
// domError
document.addEventListener('error', e => {
    this.options.closeDOM || this.report(e, { target: 'dom' })
}, {
    capture: true,
    once: false,
    passive: true,
})

// eventError
window.addEventListener('error', e => {
    this.options.closeEvent || this.report(e, { target: 'event' })
}, {
    capture: false,
    once: false,
    passive: true,
})
```

但是在http请求中，为了自主的捕获到错误，在这里使用代理的方式比较方便

```js
const _XMLHttpRequest = window.XMLHttpRequest

window.XMLHttpRequest = function() {
    ...
```

那么到这里，错误的捕获就已经完成了，但是错误的元信息肯定是有所欠缺的，
需要准确的知道当前错误所在的页面信息，于是该依赖引入了 watch-route 模块，从中获取所需的页面信息。
这里再把数据格式处理一下然后上传一下就行了(这里用的阿里云监控自定义事件)

但是针对于vue，vue因为有自己的捕获，而且我们需要详细的知道是在哪一个模块出现的问题，
这里需要针对于vue进行一次插件封装。

```js
// 这个方法忘了在哪里找的了，好像是fundebug？
// 用于获取组件的名称
const formatComponentName = vm => {
    if (vm.$root === vm) return 'root'

    const name = vm._isVue
        ? (vm.$options && vm.$options.name) ||
          (vm.$options && vm.$options._componentTag)
        : vm.name
    return (
        (name ? 'component <' + name + '>' : 'anonymous component') +
        (vm._isVue && vm.$options && vm.$options.__file
            ? ' at ' + (vm.$options && vm.$options.__file)
            : '')
    )
}
```

在这里获取到组件名称之后其实已经足够了，只是对于其他框架的错误捕获还未支持(如果其他框架也有自身的错误捕获的话)，
在后期需要的时候可以更新一下 target ，然后使用添加对应的方法，基本就没什么问题。

在2.x版本中引入了黑名单模式，因为客户端环境或其他环境中，有些自身的错误，这时候也会被捕获，
但其实是没有必要的，所以用黑名单过滤一下，减少垃圾信息。

### 结语

该依赖最初是参考 fundebug 做的，当时 fundebug 也不怎么健全，
上报信息里面有 message 及 错误栈，还有一些当前页面的路由信息。
在写这个的时候也就多了一个用户行为路线(watch-route 提供)信息，如果还要更加具体的话，
可以想想怎么样能和 source map 结合起来，给出更加准确的报错位置(在哪一行，哪一列，哪一句)，
使之更加容易定位及处理问题。




