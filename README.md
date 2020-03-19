# bobo-router

基于React Hooks的高性能路由

## 为什么是bobo

`bobo`拥有完全可靠的匹配规则(实现了`path-to-regexp`的核心部分)，拥有高性能的路由级别守卫，支持嵌套路由，懒加载等特性。并且在使用上，它几乎与`React-Router`没有区别，完全没有上手成本。

不过，`bobo-router`在小型应用中比`react-router`方便数倍，它应该成为`library`测试应用的路由库。

## 使用文档

### 组件

<b>概览:</b>

+ `Router`

+ `Route`
+ `Switch`
+ `Redirect`
+ `Lazy`



### 守卫

+ `beforeLeave`
+ `beforeEnter`
+ `beforeUpdate`



### Guard API

>  守卫是`bobo`的一个有趣用法，如果你熟悉`vue-router`，或者你需要利用进入路径和当前路径进行不同的行为时，你应该会很喜欢它。

#### beforeLeave

```
import { useGuard } from 'bobo-router'

function GuardRoute() {
	useGuard({
		type:'beforeLeave',
		to:'/url2/:id',
		resolve(navigate,next) {
			console.log('i am leave')
			next()
		}
	})
}
```

### Component API

#### Router

一个简单的例子：

```
<App>
	<Router>
		<Route></Route>
		<Route></Route>
		<head></head>
		<main></main>
	</Router>
</App>
```

`Router`作为包裹根组件，它内置了`Context`，它提供了这样一个可注入的数据结构:

```javascript
 {
   base,
   matcher,
   guardMap,
   prevPath,
 }
```

+ base: 当前真实路径，你可以理解为去除`params`之外的路径

  ```
  url:test/url/:id
  realURL:test/url/lyl
  base:test/url/
  ```

+ matcher: 一个可配置的属性，它可以接受用户传入的`matcher`作为匹配函数(不建议你这么做，因为内置的`matcher`已经足以应对正常场景),它返回如下接口的函数:

  ```javascript
  (pattern,path) => [isMatch,params]
  ```

+ guardMap: 这不是你应该使用的参数，它储存了所有的守卫，不要修改它！

+ prevPath: 顾名思义，之前的路径。

基本上，除了非常小型的应用，你都应该以`Router`组件作为根组件，因为这百利而无一害。当然，即使你不使用它作为根组件，必要的属性也会在守卫(下文会提到)里以参数的形式传入。

#### Route

`<Route path={path}>{params => ... }</Route>`

##### props:

+ `path`:一个<b>绝对路径</b>字符串，注意：path若是一个<b>相对路径</b>，则会代表参数的更换

`path="/url:id" url/abc -> url/bcd // means params id from abc to bcd`

+ `components`:满足<b>react-router</b>的风格
+ `children`:接收一个函数或组件，若为一个函数，则传入params作为参数
+ `exact`:是否精准匹配组件，详见<b>react-router exact</b>
+ `enterGuard(params,navigate,next)`
+ `updateGuard(prevParams,curParams,navigate,next)`

#### Switch

如果你只想匹配单个路由，又不愿意为路由添加`exact`属性，那么可以尝试使用`Switch`组件，它在匹配第一个组件后停止匹配，即使后面的组件能满足匹配条件

```javascript
import { Route,Switch } from 'bobo-router'

<Switch>
	<Route path="/test/all"></Route>
	<Route path="/test/:id"></Route> 
</Switch>
```



#### Redirect

#### Lazy

一个懒加载组件，它依赖了`suspense`，所以无法在`SSR`里使用，如果你有`SSR`需求，可以参考`react-lazy`

```javascript
import { Lazy } from 'bobo-router'

export () => {
	return (
		<Lazy
			loading={<Spin/>}
			component={<RealComponent/>}
		></Lazy>
	)
}
```

在未来，它甚至可以配合`use-transaction`这样的api，实现不可思议的效果，敬请期待。



### Hooks API
#### useRouter
#### useLocation