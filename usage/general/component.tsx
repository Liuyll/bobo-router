import * as React from 'react'
import { Route,Link,useLeaveGuard } from '../../src'
import { getParams } from '../../src/helper'

export default () => {
    return (
        <div>
            url1
            <p>params:{getParams(false,'/url1/:id','id')['id']}</p>
            <div>
                <Link to="/url1/wd/cmp1">go cmp1</Link>
                <Link to="hahaha">change params</Link>
            </div>
            <Route path="/url1/:id/cmp1">
                <div>i am cmp1</div>
            </Route>
        </div>
    )
}