---
sidebarDepth: 2
---

## 背景

当时快应用处于各个厂商推荐时期，所以公司也在这方面尝试一下，
但快应用项目却是早早的就已经创建了并且有了基本功能，所以之后的快应用都是基于早期版本开发，
早期的快应用也跟小程序一样，几乎没有框架，状态管理困难，埋点更加困难，开发超级困难。。。

但是没有时间来改(还是需要产品测试参与)，旧版的就不提了，说说重构版本。
重构版本是自己搭的一套增强型框架，使用原生语法(第三方在快应用上面不好使)。

::: warning 旧版
项目地址：mi-app

这里需要注意一下分支：

* merge-2 书香、即阅 通用模块分支，在有相同需求的时候在这个分支上修改，修改完成后合并到 书香 和 即阅分支
* jiyue_July 书香分支，书香单独需求时在这个分支上修改
* jiyue_new 即阅分支，即阅单独需求在这个分支上修改
:::

::: warning 新版
项目地址：sx_quick_app

这里也需要注意一下分支：

* merge 书香、即阅、墨香 通用模块分支，在有相同需求的时候在这个分支上修改，修改完成后合并到 书香、即阅、墨香 分支
* sx_2.x 书香分支，书香单独需求在这个分支上修改
* jy_2.x 即阅分支，即阅单独需求在这个分支上修改（但即阅目前没有重构的需求，有需求的时候只需要修改对应的配置即可，下面会讲到）
* mx_2.x 墨香分支，墨香单独需求在这个分支上修改
:::

::: danger 关于分支
在这里着重说明一下分支的使用，因不同项目使用同一套代码，所以通过不同分支做区分，

如果有新需求，如果是所有包都需要的需求，那就可以直接在 merge 分支上进行需求跟进；

如果是单独一个包的需求，一定要在 merge 分支上再拉取一个分支出来进行需求跟进，然后合并到对应的包，例如 sx_1.6.0 sx_1.6.1 这类分支，
其实都是书香单独的需求，所以单独拉取分支出来单独合并，一定要这么做！
:::

## 开始

```js
const { 
    usePage, useComponent, useConnect, useWatch, useComputed, useStore, useStat, useWebview,
    $store, $router, $native, $utils, $stat, $nodeStat, $third,
} = getContext()

export default useConnect(
    useStore('Root', state => ({
        test: state.test
    })),
    usePage({
        data: {
            test2: 1
        }
    })
)
```

这里会一个一个讲解，先讲思路

## 初步设想

快应用的语法 小程序的语法 其实都是跟 vue 差不多的，但是又欠缺了 vue 的部分功能，
又不能像 react 那样函数式组件没有什么局限，所以需要对功能进行扩展，
在 vue 中比较好用的就是 computed 和 watch，那么就需要对这两个功能进行支持。
因为快应用自身是 getter setter 的语法，所以这里其实不好去做一层代理，
于是就新增一个赋值的方法 setData

> 文件 render/setData.js

```js
const setData = (target, data) => {
    // 更新的值的数组
    const updates = []

    if (!target || !data) return updates

    Object.keys(data).forEach(key => {
        // 检测新值与旧值是否有更改
        if (change(target[key], data[key])) {
            updates.push({
                key,
                oldValue: target[key],
                newValue: data[key],
            })

            target[key] = data[key]
        }
    })

    return updates
}
```

在这里我就可以拿到返回的 updates ，来做 computed 的更新及 watch 的触发，其实也相当于是一个订阅更新的操作。

那么最初的想法就已经实现了？

## 生命周期驱动

在写框架的时候，比如这个 setData 我需要注入到页面实例中，那么必然的我就会使用代理，
来达到所有页面都能使用的目的。

```js
const { onInit } = page

page.onInit = function() {
    this.setData = setData

    return onInit && onInit.call(this)
}
```

但是显然，连 setData 这一个方法都需要代理，那如果有其他增强是不是也需要代理？
如果都要代理，那代码可读性是不是非常低？各类代理是否会有执行顺序问题？

为了解决这个问题，我统一在一个文件中进行代理，
通过权重(具体见源码)的方式控制顺序，通过遍历的方式顺序执行回调，抛出一个添加生命周期方法，
从而达到增强可读性，降低复杂性的目的，也解决了顺序调用的问题。

> 文件 render/lifecycle.js

```js
const { onInit } = page

params.onInit = function (...arg) {
    // 在这里统一执行回调
    runHooks(this, { target, options }, 'onInit', ...arg)

    return onInit && onInit.apply(this, arg)
}

// 这是添加生命周期的方法
export const addLifecycle = (type, callback, { target, priority, interdict } = {}) => {
    ...
```

在这个时候，一个非常实用的api就成了。那么我只需要这样使用

```js
// 现在就变得优雅又简单了
addLifecycle('onInit', function () {
  this.setData = setData.bind(this)
})
```

那么就可以进行其他功能的完善了，就从 开始 中的功能一个个叙述。

## useConnect

> 文件 render/connect.js

这个方法是想到了 redux 的 connect 方法，

```js
connect(mapState, mapDispatch)(page)
```

那通过 connect 的方式来连接增强功能与页面，可以达到类似插件的效果(解耦，按需使用，可读性好)，
至于我为什么把 usePage 放里面，因为放外面不好看。

```js
// 这里因为传入参数顺序不定，数量不定，所以需要进行一个区分
// 比如 useStore 会返回一个 { type: 'useStore', use(params) { ... } }
// 没有返回的就默认为 page/component
export default (...arg) => {
    if (arg.length < 1) return {}

    const params = arg.find(item => !item.type) || {}
    const useStores = arg.filter(item => item.type === 'useStore')
    const useComputed = arg.find(item => item.type === 'useComputed')
    const useWatch = arg.find(item => item.type === 'useWatch')

    // 通过将 page/componet 对象传递给需要的模块，以引用的特性来进行修改
    // 有执行顺序
    useStores.forEach(item => item.use(params))
    useComputed && useComputed.use(params)
    useWatch && useWatch.use(params)

    // 这里是对外进行的一个扩展，例如 useWebview
    queue.forEach(callback => callback(arg, params))

    return params
}
```

那这里一个 useConnect 就完成了，接下来就是完成其他增强功能了

## usePage useComponent

> 文件 render/page.js

> 文件 render/component.js

```js
// 这就是全部代码了，useComponent也是一样的
// 这里也是一样通过导出添加回调的方式进行解耦(大部分都可以这么做)
// 主要给自定生命周期(文件 render/lifecycle.js)使用
const hooks = []
const _Page = (params, options) => {
  // 处理数据
  hooks.forEach(fn => fn(params, options))

  // 页面类型
  params.getConnectType = () => 'usePage'

  return params
}

_Page.use = fn => hooks.push(fn) 
export default _Page
```
## useComputed

> 文件 render/computed.js

计算属性，使用与 vue 几乎一致，接收一个对象作为参数，对象值为函数

```js
useComputed({
    test() {
        return this.xxx
    }
})
```

该方法在调用的时候会将对象中的key值注入到 page/component 的 data 参数中去(为了触发页面渲染，见源码)，
然后将计算规则绑定到当前 page/component 上面，得以在运行时可以使用当前实例 this。
导出一个 update 的方法，在 setData 使用的时候，进行更新的操作。

```js
// 方法接收一个来自 setData 更新后改变的值得数组
// 然后进行计算(就是执行传入的key对应的函数)
export const update = function (updates) {
    const computedUpdates = this.getComputedParams ? setComputed(this.getComputedParams(), this) : []
    const repeat = {}

    // 拿真的旧值和最后的新值
    computedUpdates.forEach(item => {
        if (!repeat[item.key]) repeat[item.key] = { oldValue: item.oldValue, newValue: item.newValue }
        else repeat[item.key].newValue = item.newValue
    })

    const realUpdates = Object.keys(repeat).map(key => ({ key, ...repeat[key] }))

    // 计算完成后给 useWatch 使用
    update.listener && update.listener.call(this, updates.concat(realUpdates))
}
```

但是在这里是没有做像 vue 那样的缓存结果属性的，需要的话通过代理一层 this 来达到相同的效果。

## useWatch

> 文件 render/watch.js

监听，用法与 vue 几乎一致，附加功能支持到 immediate

```js
useWatch({
    ['test'](newValue) {
        console.log(newValue)
    },
    ['test2']: {
        immediate: true,
        handler(newValue) {
            console.log(newValue)
        }
    }
})
```

这里思路很简单，就是拿到 setData 和 computed 的 updates ，然后遍历一遍 key，
然后执行对应 watch key 的方法就行了。

```js
updates.forEach(item => watchs[item.key] && (
    typeof watchs[item.key] === 'function' ?
        watchs[item.key].call(this, item.newValue, item.oldValue) :
        (watchs[item.key].handler && watchs[item.key].handler.call(this, item.newValue, item.oldValue))
))
```

## useStore

> 文件 render/store/*.js

store 文件使用格式

```js
// 状态声明好了之后需要在 /store/index 中加入
import render, { Store } from '../render'

// 需要 dispatch 从render中获取
const { $store: { dispatch } } = render

// 需要缓存的字段，可选
export const storage = ['count']
// 状态实例，必须导出
export const store = new Store({
    count: 0
})

// 通过 dispatch('<key>/setCount', 1) 调用
export const setCount = (num) => {
    // 获取值
    const { count } = store.get()
    // 设置值
    store.set({ count: count + num })
}
```

store.js 状态库文件，实现非常简易(stat, set, get, subscribe)，具体见源码

```js
class Store {
    constructor(state) {
        this.state = state
        this.hooks = []
    }
    // 在 set 中，在设置值的时候与 setData 一样，会有一个更新数组 updates
    // 用于订阅回调使用
    set(params) { ... }
    get() { return this.state }
    subscribe(callback) { this.hooks.push(callback) }
    unsubscribe(callback) { ... }
}
```

由于快应用限制，无法使用局部状态管理，所以只能把所有状态统一管理，
于是这里有 addStore.js 文件，进行各个 store 模块的整合。
还有一个 middleware.js 文件，用于各个 store 模块的调用，抛出 getState dispatch 方法

```js
// 返回 key 为 Root 的 store 模块的所有状态 
getState('Root')
// 调用 key 为 Root 的 store 模块的 setTest 方法，并传入值 1
dispatch('Root/setTest', 1)
```

在管理状态的时候，有的状态往往需要进行缓存处理，那这时候就有 storage.js 文件，来做缓存的处理。

```js
// 这里将所有拿到的 store 模块，进行了一次订阅
// 其实这里可以不把 storage 模块与 store 模块放在一起
// 因为 storage 模块其实是一个工具类型，完全可以放出去，减少代码关联性
Object.keys(Store).forEach(key =>
    Store[key].store.subscribe(updates =>
        // 在给定的需要缓存的 key 的列表中，匹配到对应的状态进行缓存
        useStorage({
            key,
            updates,
            storage: Store[key].storage,
        })
    )
)
```

在应用进来的时候，需要去读取一遍缓存，然后进行同步，但是读缓存是异步的，
假如在缓存读取完成之前去操作 store 肯定是有问题的，所以需要一个状态准备阶段。
在文件 middleware.js

```js
async onReady(callback) {
    // 准备阶段，比如准备缓存
    await Promise.all(storeBeforeReadyQueue.splice(0, storeBeforeReadyQueue.length).map(fn => fn(Store)))
    // 准备完毕
    storeReady = true
    // 在准备完成之前被推入等待队列的回调，在完成之后执行
    storeAfterReadyQueue.splice(0, storeAfterReadyQueue.length).forEach(fn => fn())

    callback()
},
```

光有准备阶段不能解决问题，因为 page/component 的生命周期是单独的流程，所以在 app.ux 新增了一个自定义的生命周期，
保证该生命周期执行的时候，store 是一定准备完成的。

```js
addLifecycle('onInit', function (...arg) { this.onPageInit && storeReadyAfter(this.onPageInit.bind(this, ...arg)) })
addLifecycle('onShow', function () { this.onPageShow && storeReadyAfter(this.onPageShow.bind(this)) })
```

store 的准备阶段耗时约为 100~300ms ，在有开屏页面的应用是可以接受的，但也可以优化，就是按需加载(在使用时去读取缓存)。

在这时 store 的功能基本完成了，剩下的就是如何与页面进行绑定，于是有文件 useStore.js。
与页面数据的思路与 useComputed 一致，将使用的 key 写入到 data 里面，促使页面渲染。
然后在 onInit 的时候进行一次订阅更新

```js
addLifecycle('onInit', function () {
    if (!this.getStateData) return
    // 更新数据方法，id 用作优化赋值
    this.updateState = ({ id } = {}) => this.setData(this.getStateData(id), { sync: true })
    // 订阅 store 更新
    subscribe(this.updateState)
    // 初始化时再走一遍数据赋值，以防在别的地方改变了但并未初始化造成的不同步
    this.updateState()
}, { priority: 6 })

addLifecycle('onDestroy', function () {
    if (!this.getStateData) return
    // 在销毁的时候取消订阅
    unsubscribe(this.updateState)
    this.updateState = null
})
```

到这里，整个状态的管理以及与页面的绑定就已经完成了，若需要其他功能，通过订阅的方式去扩展，基本能够完成支持。

## useStat

> 文件 stat/*.js

埋点功能。由于埋点需要页面参数、页面行为路线，在这里需要有两个基本数据：页面行为路线、页面栈。

关于页面的东西肯定离不开路由，所以有 render/router.js 文件，用于处理路由的拦截，一样通过钩子的形式，
对页面行为路线和页面栈进行修改(比如前进一个页面，就 push 一个页面信息)，再对离开页面的生命周期 onBackPress 进行一次代理，
使页面栈能够正确的跟随用户行为。处理页面行为路线、页面栈在 stat/stack.js 文件。

```js
// 当使用 push 的时候也同时 push 一个页面栈、页面行为路线，其他同理
addRouteHooks('push', function (url, params) {
    addPageChain()
    updatePageStack('push', { url, params })
})
```

在这时候拿到了正确的页面栈，但对于埋点来说还差页面的埋点信息，
所以这时候有一个 useStat.js 文件，来处理当前页面的埋点信息。

```js
useStat(function () {

    return {
        page: '首页',
        pageParams: {
            xxx: 123
        }
    }
})
```

在之前的项目中，组件内的埋点都需要提取到页面来执行，因为需要页面的埋点信息，
但是现在，通过把埋点信息绑定到页面栈的方式，组件内的埋点可以直接从页面栈里面去拿，
从而达到埋点与页面解耦的目的，解放了大量的埋点劳动力。

```js
// 在 onShow 的时候，将当前页面埋点信息的获取方式推入页面栈
updatePageStackLast(() => {
    // statParams 这一条就是 useStat 传入的回调函数返回的值了
    const statParams = this.getStatDefaultParams ? this.getStatDefaultParams.call(this, this) : {}
    const { id, path } = this.getOwnPageParams()

    return {
        path,
        name: pageName[path] ? pageName[path].page : '',
        id,
        statParams,
    }
})
```

这里就完成了埋点与页面的解耦，可以在需要的地方直接埋点，而不用担心页面参数的问题。

在埋点需要的参数里面，有父页面 parent 的参数，按照需求，父页面指的是上一个浏览的页面，
这里页面栈是无法满足这个需求的，所以才会有用户行为路线这个链条，
不管在用户是 push replace back 还是什么操作，都只需要 push 当前页面参数，
这样 parent 就只需要拿 用户行为路线 的最后一个值就行，但最后一个值需要在页面离开的时候更新一下，
保证拿到的是需要的埋点数据

```js
addLifecycle('onHide', function () {
    const statParams = this.getStatDefaultParams ? this.getStatDefaultParams.call(this, this) : {}
    const { id, path } = this.getOwnPageParams()

    // 页面离开的时候更新最后一个页面的参数
    updatePageChain({
        path,
        name: pageName[path] ? pageName[path].page : '',
        id,
        statParams,
    })
}, { target: 'page', priority: 10 })
```

到这里基础数据就已经解决了，那么只需要在 onShow onHide 的时候分别调用就解决了页面的展示隐藏埋点上报了

```js
addLifecycle('onShow', function () {
    time = Date.now()
    // 展示上报
    $stat()
}, { target: 'page' })

addLifecycle('onHide', function () {
    // 离开上报
    $stat({
        target: '页面end',
        actionParams: { duration: Date.now() - time },
    }, { outPage: true, useLast: true })
}, { target: 'page' })
```

埋点需求有一个节点的展示埋点，这里通过节点的方法 onappear 来触发，通过传入 id 来进行上报限制。

## useWebview

> 文件 webview/*.js

这一块是对 webview 页面/组件的统一交互支持，使用条件比较严格(尝试过web组件化，但是支持性不佳)，
详细的使用请参考 webview 页面。

```js
// 在模板上，这里的事件都是与 id 关联的，以 id 为前缀命名
// useWebview 已经将这些方法写到了 page 中，所以不必再写，在 merge.js 文件
<web id="web" class="web-comp" src="{{websrc}}" trustedurl="{{web_trustedurl}}" allowthirdpartycookies="{{web_allowthirdpartycookies}}" onpagestart="web_onPageStart" onpagefinish="web_onPageFinish" ontitlereceive="web_onTitleReceive" onerror="web_onError" onmessage="web_onMessage"></web>

// 这里的 web 是 web 组件的 id 值
useWebview('web')
```

这里将所有的交互方法都写在了 message-to-web.js 文件中，交互过程在 merge.js 文件中

```js
[`${webId}_onMessage`](e) {
    // web给快应用发送消息
    console.log('web给快应用发送消息', decode(e.message))
    const { key, data } = JSON.parse(decode(e.message))

    // 空的信息
    if (key === 'kyy_push_notice') return

    try {
        // web 组件接收到来自 web 的消息时，执行对应的方法
        messageToWeb[key]({
            success: arg => this[`${webId}_onPostMessage`]({ key: 'successCallback', data: arg }),
            fail: arg => this[`${webId}_onPostMessage`]({ key: 'errorCallback', data: arg }),
            cancel: arg => this[`${webId}_onPostMessage`]({ key: 'cancelCallback', data: arg }),
            page: this,
        }, ...data)

    } catch (error) {
        console.error(key, '方法不存在或执行错误', error)
        this[`${webId}_onPostMessage`]({ key: 'errorCallback', data: { key, error: error.stack } })
    }
},
[`${webId}_onPostMessage`]({ key, data }) {
    // 快应用给web发送消息
    console.log('快应用给web发送消息', key, data)
    const web = this.$element(webId)

    if (web) {
        // 发送内容
        // 这里的 encode 编码比较重要，因为有的符号无法正常发送
        web.postMessage({ message: encode(stringify({ key, data })) })
        // 给h5一个立即的答复，防止具体内容被吞
        // 这里是因为在测试的过程中，发现有时候消息并不能及时的发送到 web 页面
        // 通过尝试后，再发送一个空的交互，可以达到正常通信的效果
        web.postMessage({ message: encode(stringify({ key: 'kyy_push_notice', data: {} })) })
    }
},
```

## 实用工具

这里推荐一下非常实用的方法

### addHook getHook

> 文件 utils/utils.js

```js
// 处理钩子的函数，返回函数销毁当前钩子
const hooks = {}
export const addHook = (key, callback) => {
    if (!hooks[key]) hooks[key] = {
        id: 0,
        queue: [],
    }

    const current = hooks[key]
    const params = {
        id: current.id++,
        callback,
    }

    current.queue.push(params)

    return () => {
        const index = current.queue.findIndex(item => item.id === params.id)
        if (index > -1) current.queue.splice(index, 1)
    }
}
export const getHook = key => (hooks[key] ? hooks[key].queue : []).map(item => item.callback)

// 如何使用？
// 添加钩子
addHook('<key>', callback)
// 调用钩子
getHook('<key>').forEach(fn => fn())
```

钩子的控制可以用在很多地方：用户信息改变时需要清除一些信息、添加桌面弹窗时需要展示提示弹窗等等

### addDispatchQueue

> 文件 render/addDispatchQueue.js

这里也可以不是 dispatch 队列，只是随便起的名字，只要是个 promise 就行，非常实用。
比如 getUserInfo 方法，getUserInfo 在很多地方使用，但是不需要担心在多个地方同时调用引起的多个请求，
达到优化的目的。

```js
// dispatch队列
const dispatchQueue = {};
const dispatchRuning = {};
const dispatchRunQueue = async key => {
    const current = dispatchQueue[key].shift()

    if (!current) return dispatchRuning[key] = false

    dispatchRuning[key] = true

    await Promise.race([
        Promise.resolve(current.callback())
            .then(res => current.resolve(res))
            .catch(err => console.error('runQueue', key, err))
        ,
        new Promise(resolve => setTimeout(resolve, 5000))
    ])

    dispatchRunQueue(key)
}

const start = (key) => !dispatchRuning[key] && dispatchRunQueue(key)

export const addDispatchQueue = (key, callback) => {
    if (!dispatchQueue[key]) dispatchQueue[key] = []

    return new Promise(resolve => {
        dispatchQueue[key].push({
            callback,
            resolve,
        })

        start(key)
    })
}
```

## 关于配置

有关应用的配置以及图片的配置，我都统一提取到了 project/*.js 文件中，
在跟进到新的包时，只需要拉一个新分支，然后修改文件里面的内容即可。

## 结语

在这一个框架中，扮演最重要的角色其实就是生命周期，也就是 addLifecycle 方法，
在很多地方都可以使用，并且非常方便，侧面也说明了钩子的方便，所以在这个项目中，
我很多地方都使用了钩子，比如用户信息改变钩子、添加桌面弹窗钩子等等。
通过一个方法带动其他回调的方式，达到解耦的目的。

其实在开始的时候是没有想到 addLifecycle 的方式的，只是单纯的一层一层的代理，
写着写着就会觉得理解困难，才想到使用这种方式来处理，只是没想到效果出乎意料的好。

对于状态管理的思路也来自头条小程序，在那之前写的 redux 及 vuex 都太过繁琐，且难以理解。
但是假如一个状态管理只有 get set 的时候，就变得非常简单直接了，能够简化大量的垃圾代码(像 this.$store.dispatch 前面的 this.$store 也是垃圾代码，所以我放在了全局，解耦后直接 dispatch)。

对于埋点这一块，将页面信息放到页面栈上面后简直好多了，再也不用担心埋点耦合的问题了，
当前页面调用的埋点传的一定是当前页面的埋点信息，可以写在组件内，写在 utils 中，写在web交互方法中，
就跟 store 一样，完全解耦。




