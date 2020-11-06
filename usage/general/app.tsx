/* eslint-disable */

import * as React from 'react'
import { Route,Link,useLeaveGuard,useRouter,useLocation,connectGuard } from '../../src'
import { useState } from 'react'
import URL1Component from './component'
import Lazy from '../lazyload'

const App:React.SFC<any> = function(){
    const RouteGuardComponent = (props) => {
        const [a,setA] = useState(1)
        // useGuard({
        //     to: '/url2/:id',
        //     resolve(navigate,next){
        //         console.log('emit guard / to url2')
        //         next()
        //     },
        //     type: 'beforeLeave'
        // })
        return (
            <div style={{ display: props.display === 'none' ? 'none' : 'block' }}>
                <div>
                    <button onClick={() => setA(a => a + 1)}>add</button>
                </div>
                {a}
            </div>
        )
    } 

    const TestGuard = connectGuard('beforeEnter',(prevPath,navigate,next) => {
        console.log('enter')
        next()
    },'*')(RouteGuardComponent)

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
            <ReturnComponent></ReturnComponent>
            {/* <div>path:{useLocation()[0]}</div> */}
            <Route path="/" isAlive={true}>
                {/* <RouteGuardComponent/> */}
                <TestGuard/>
            </Route>
            <Route path="/url1/:id" updateGuard={
                (beforeParams,currentParams,navigate,next) => {
                    console.log(beforeParams,currentParams)
                    next()
                }
            }>
                <URL1Component/>
            </Route>
            <Route exact path="/url2/:id" enterGuard={
                (params,navigate,next) => {
                    console.log('beforeeach emit params:',params)
                    // navigate('/url1')
                    next()
                }
            }>
                <RouteGuardComponentURL2/>
            </Route>
            <Lazy></Lazy>
        </div>
    )
}

export { App }