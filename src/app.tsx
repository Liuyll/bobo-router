///<reference types="webpack-env" />

import * as React from 'react'
import { Route,Link,useGuard,useRouter,useLocation } from './bobots'
import URL1Component from './component'
import Lazy from '../test/lazyload'
import { Suspense,lazy } from 'react'

if(module.hot){
    /* 该dependency还需要研究
      [参考](https://github.com/Jocs/jocs.github.io/issues/15)
      hmr只做非jsx的模块更新,也就是只做js逻辑业务的更新
      eg:accept('/hello.js',() => {
          test.innerHTML = hello()
      })
    */
    module.hot.accept('./')
}

const App:React.SFC<any> = function(){
    const RouteGuardComponent = () => {
        useGuard({
            to: '/url2/:id',
            resolve(navigate,next){
                console.log('emit guard / to url1')
                next()
            },
            type: 'beforeLeave'
        })
        return (
            <div>
                /
            </div>
        )
    } 

    const RouteGuardComponentURL1 = () => {
        useGuard({
            to: 'url2',
            resolve(navigate,next){
                console.log('emit guard url1 to url2')
                next()
            },
            type: 'beforeLeave'
        })
        return (
            <div>
                url1
            </div>
        )
    } 

    const RouteGuardComponentURL2 = () => {
        return (
            <div>
                url2
            </div>
        )
    } 

    const ReturnComponent = () => {
        return (
            <>
                <Link to="/">/</Link>,
                <Link to="/url1/lyl">url1</Link>,
                <Link to="/url2/lyl">url2</Link>,
            </>
        )
    }

    return (
        <div>
            {/* <div>path:{useLocation()[0]}</div> */}
            <Route path="/">
                <div>//////</div>
                <ReturnComponent></ReturnComponent>
                <RouteGuardComponent/>
            </Route>
            <Route path="/url1/:id">
                <ReturnComponent></ReturnComponent>
                <URL1Component/>
            </Route>
            <Route exact path="/url2/:id" enterGuard={{
                resolve(params,navigate,next){
                    console.log('beforeeach emit params:',params)
                    // navigate('/url1')
                    next()
                },
                path: '/url2/:id'
            }}>
                <ReturnComponent></ReturnComponent>
                <RouteGuardComponentURL2/>
            </Route>
            <Lazy></Lazy>
        </div>
    )
}

export { App }