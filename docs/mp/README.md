---
sidebarDepth: 2
---

## 公司在小程序方面好像都只是浅尝辄止？

> 项目地址：美阅读

这个项目在框架层次近乎没有，状态管理也只是一个 globalData，使用起来非常不便。

```js
if (getApp().globalData.data.userInfo.ticket) {
    let imgurl = getApp().globalData.data.userInfo.user.icon;

    this.setData({
        ticket: getApp().globalData.data.userInfo.ticket,
        imgUrl: string.computedImagePath(imgurl)
    })
}
```

对于页面的管理也是自己页面只处理自己页面的事情，导致了很多不必要的操作(其实也是无状态管理引起的)，
对于路由的管理也没有(可能是因为当时没有埋点需求？)，这里也不再赘述。

小程序的项目到后来也是通过 gulp 进行文件后缀的替换，内容关键字的替换，达到多平台的目的(确实当时的第三方框架都挺差劲)，
但是小程序做了这么多，好像也没有怎么去推广(或者说推广了也没见到什么收益？)，之后也就不了了之。

下一个。


## 头条小程序

> 项目地址：头条小程序

项目创建时间比较近(19年11月左右)，大家都愿意尝试使用 react 来编写，
之后使用了 taro(其实我开始是不太看好第三方，但后面写下来发现第三方确实也相对成熟了)，
react 出了一个 HOOK 功能，使函数式组件也有 class 组件的功能(渲染完成、数据更新等)

```js
useEffect(() => {
    ...
}, [...])
```

从而大大的减小了项目复杂度，不再需要一堆 connect、class 重复的垃圾代码，变得更加直观。

由于仅参与了项目初期的建设，对于该项目的理解仅存在初期阶段，
当时使用了轻量的状态库 laco，通过订阅(subscribe)的方式通知视图更新。

```js
/**
 * 通过 useEffect 来做订阅与取消订阅
 * @param {Store} store - laco 的 store 实例
 * @param {String} key - 需要本地存储的 key
  */
export default function useStore({ store, key }: Params) {
    const [state, setState] = useState(store.get());

    function updateState() {
        // 有key时做缓存处理
        if (key) Taro.setStorageSync(getKey(key), store.get());
        setState(store.get());
    }

    useEffect(() => {
        // 这里做一次更新是为了防止在初始化到订阅之间的时候，store被修改
        updateState()

        // 在这里进行订阅
        store.subscribe(updateState)
        // 在销毁时取消订阅
        return () => store.unsubscribe(updateState)
    },[]);

    return state;
}
```

但是该项目把状态的管理分成了多个目录分开处理，导致新增一个方法需要在多个目录下面进行修改(或者说这里其实还有着redux的影子)，
其实这是没有必要的，store 的创建和修改完全可以写在一起，因为多个模块文件(book.ts home.ts)已经达到了分块的目的了，如果还要细分，可以继续创建模块文件。
这里的缓存其实也可以通过订阅来做，所以是有优化空间的。










