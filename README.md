# bobo-router

基于React Hooks的高性能路由

## 为什么是bobo

bobo拥有完全可靠的匹配规则(实现了path-to-regexp的核心部分)，拥有高性能的路由级别守卫，支持嵌套路由，懒加载等特性。并且在使用上，它几乎与React-Router没有区别，完全没有上手成本。

## 使用文档

### 组件

+ `Router`
+ `Route`
+ `Switch`
+ `Redirect`
+ `Lazy`

### 守卫

+ `beforeLeave`
+ `beforeEnter`
+ `beforeUpdate`



### Component API

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
