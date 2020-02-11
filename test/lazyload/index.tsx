// lazyload component
// cant support in ssr
// in ssr please use react-lazyload
// https://github.com/twobin/react-lazyload


import * as React from 'react'
import { Lazy } from '../../src/bobots/index'

export default () => {
    return (
        <Lazy 
            loading={<div>i am loading</div>}
            component={() => import('./load_component') as any}
        />
    )
}


