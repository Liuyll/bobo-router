import { useLocation as useLocationHook,navigate,fuzzyMatchGuard }  from './useLocation'
import makeMatcher from "./matcher"
import { useActionEffect } from './tools'
import { routeMode, setRouteMode, RouteMode } from './mode'

import {
    useRef,
    useLayoutEffect,
    useEffect,
    useContext,
    useCallback,
    isValidElement,
    cloneElement,
    createElement as h,
    Suspense,
    lazy,
} from "react"

import { RouterCtx,store,isMatch,params,matchFn } from './context'
export { getParams } from './helper'

interface ILeaveGuard {
    (navigate:Function, next:Function):void
}

interface IEnterGuard {
    (params: Object, navigate:Function, next: Function):void
}

type RouteProps = {
    path:string,
    match ?: matchFn
    enterGuard ?: EnterRouteGuard,
    updateGuard ?: UpdateRouteGuard,
    component ?: React.FC | React.ComponentClass,
    exact ?: boolean,
    isAlive ?: boolean
} 

type updateGuardStruct = {
    timer:number;
    path:string;
    prevParams:params;
}

type guardTypes = 'beforeLeave' | 'beforeUpdate' | 'beforeEnter'

interface RouterGuard {
    path ?: string,
    to:string,
    resolve:(navigate:navigate,next:Function) => void,
    type:"beforeLeave" | "beforeEnter"
} 

interface EnterRouteGuard {
    (params:any,navigate:navigate,next:Function) : void,
}

interface UpdateRouteGuard {
    (beforeParams:params,currentParams:params,navigate:Function,next:Function):void
}

enum ExecuteGuardType {
    None,
    Update,
    // If not in exact mode. However should execute update instead enter
    Update_UnResolve,
    Enter,
}

const buildRouter = ({
    base = "",
    matcher = makeMatcher() as any,
    enterGuardMap = {},
    leaveGuardMap = {},
    prevPath = ""
}:store['v'] = {} as store['v']) => ({ base, matcher,leaveGuardMap,prevPath, enterGuardMap })

const useRouter = () => {
    const globalRef = useContext(RouterCtx)
    return globalRef.v || (globalRef.v = buildRouter())
}

const useLocation = () => {
    const router = useRouter()
    return useLocationHook(router)
}

const useRoute = (pattern:RegExp | string):[[isMatch,params],string,(type:"replace" | "to",url:string) => void] => {
    const [path,navigate] = useLocation()
    return [useRouter().matcher(pattern, path),path,navigate]
}

const useNestRoute = (pattern:RegExp | string,prevMatchObject?:updateGuardStruct):[[isMatch,params],string,(type:"replace" | "to",url:string) => void] => {
    const [path,navigate] = useLocation()
    const matcher = useRouter().matcher

    const match_paths = path.split('/')
    let routeMatch:[isMatch,params] = [false,{}]

    // avoid '/' Component show in any router
    for(let i = 1,base = "/";i < match_paths.length;i++) {
        let curPath = base + match_paths[i]
        const result = matcher(pattern,curPath)
        if(result[0]) {
            if(prevMatchObject) {
                if(prevMatchObject!.path !== curPath) {
                    prevMatchObject.path = curPath
                    prevMatchObject.timer++
                    prevMatchObject.prevParams = result[1]
                }
            } 
            routeMatch = result
            break
        }
        base += match_paths[i] + '/'
    }
    routeMatch[0] || prevMatchObject && (prevMatchObject.timer = 0,prevMatchObject.prevParams = {})
    return [routeMatch,path,navigate]
}

const Router = props => {
    const ref = useRef<null | store>(null)

    // only in first render to call buildRouter
    const value = ref.current || (ref.current = { v: buildRouter(props) })

    return h(RouterCtx.Provider, {
        value: value,
        children: props.children
    })
}

const Route:React.FC<RouteProps> = ({ path, match, component, children, enterGuard,updateGuard,exact = false,isAlive }) => {
    const updateParamsRef = useRef<updateGuardStruct>({ path: "",timer: 0,prevParams: {} })
    const prevParams = updateParamsRef.current.prevParams
    const [routeMatch,basePath,navigate] = !exact ? useNestRoute(path,updateParamsRef.current) : useRoute(path)
    const globalCtx = useRouter()

    useActionEffect(() => {
        if(!enterGuard) return
        let guardGroup = JSON.stringify({ from: '*',to: path })
        globalCtx.enterGuardMap[guardGroup] = (params,next) => enterGuard(params,navigate,next)
    },[enterGuard])
    const [matches, params] = match && match(path,basePath) || routeMatch

    if(!matches) {
        if(!isAlive) return null
        else return renderChild({ display: 'none' })
    }

    // beforeEnter | beforeUpdate guard
    globalCtx.prevPath = basePath
    // judge execute RouteGuard Type
    // Type: Update | Enter 
    // emit UpdateGuard
    let _next = false
    const next = () => _next = true
    let executeGuardType = ExecuteGuardType.Enter
    if(updateParamsRef.current.timer > 1) {
        // only emit UpdateGuard in unExact Mode 
        if(!exact) {
            if(updateGuard) {
                updateGuard(prevParams,updateParamsRef.current.prevParams,navigate,next)
            } else next()
            executeGuardType = ExecuteGuardType.Update
        }
        else executeGuardType = ExecuteGuardType.Update_UnResolve
    }

    if(executeGuardType == ExecuteGuardType.Enter) {
        const from = '*'
        const guardGroup = JSON.stringify({ from: from,to: basePath })
        const executeGuard = globalCtx.enterGuardMap[guardGroup]  
        
        if(executeGuard) {
            executeGuard(null,next) 
        } else {
            const matched = fuzzyMatchGuard(globalCtx,basePath, '*', 'enterGuardMap')
            if(matched[0]) {
                const fuzzyExecuteGuard = globalCtx.enterGuardMap[matched[0]]
                fuzzyExecuteGuard(matched[1],next)
            }
            else next()
        }
    }

    if(!_next) return null
    return renderChild()

    function renderChild(extraProps ?: object) {
        if (component) return h(component, { params,...extraProps } as any)

        // support render prop or plain children
        return typeof children === "function" ? cloneElement(children(params),extraProps) : cloneElement(children as any,extraProps)
    }
}

const useLeaveGuard = (props:Exclude<RouterGuard, 'type'>) => {
    const [curPath,navigate] = useLocationHook()
    const { path = curPath,resolve,to } = props
    const globalRef = useContext(RouterCtx)
    
    useEffect(() => {  
        let realPath = path
        const currentGuardFlagGroup = JSON.stringify({ from: realPath,to })
        globalRef.v.leaveGuardMap[currentGuardFlagGroup] = next => resolve(navigate,next)
    },[path,resolve,to])
}

const connectGuard = (type:Exclude<guardTypes,'beforeUpdate'>,resolve:ILeaveGuard | IEnterGuard,from:string,to?:string) => (Component:React.FC):React.FC => {
    if(type === 'beforeEnter' || !to) {
        to = '*'
    }

    return (props) => {
        const { children,...others } = props
        const matcher = useRouter().matcher
        const globalRef = useContext(RouterCtx)
        const { prevPath } = globalRef.v
        const [curPath,navigate] = useLocationHook()

        let nextRender = 0
        const next = () => {
            nextRender = 1
        }

        if(type === 'beforeEnter' ) {
            if(from === '*' || matcher(from,prevPath)[0]) {
                (resolve as IEnterGuard)(prevPath,navigate,next)
            }
        } else if(type === 'beforeLeave') {
            const resolve1:ILeaveGuard = resolve as ILeaveGuard
            useLeaveGuard({
                resolve: resolve1,
                to,
                type: 'beforeLeave'
            })
            nextRender = 1
        }

        if(nextRender) return h(Component,others,children)
        return h('div')
    }
}

const Link = props => {
    const [, navigate] = useLocation()
    const { base } = useRouter()

    const href = props.href || props.to
    const { children, onClick, tag } = props

    const handleClick = useCallback(
        event => {
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                event.shiftKey ||
                event.button !== 0
            )
                return

            event.preventDefault()
            navigate(href)
            onClick && onClick(event)
        },
        [href, onClick, navigate]
    )

    const extraProps = { href: base + href, onClick: handleClick, to: null }
    // default render 'a' component
    const render = isValidElement(children) ? children : h(tag ? tag : "a", props)

    return cloneElement(render, extraProps)
}

const Switch = ({ children, location }) => {
    const { matcher } = useRouter()
    const [originalLocation] = useLocation()

    children = Array.isArray(children) ? children : [children]

    for (const element of children) {
        let match:[boolean,params]

        if (
            isValidElement(element) &&   
            // this allows to use different components that wrap Route
            // inside of a switch, for example <AnimatedRoute />.
            (match = element.props['path']
                ? matcher(element.props['path'], location || originalLocation)
                : [false, {}]
            )[0]
        ) return cloneElement(element, { match,path: element.props['path'] } as any)
    }

    // eslint-disable-next-line
    console.warn(`
        Switch component has no suitable render element;
        please check path prop
    `)
    return null
}

const Redirect = props => {
    const [, push] = useLocation()
    useLayoutEffect(() => {
        // layout has finished 
        // replace url to new 
        push("replace" ,props.href || props.to)

    // we pass an empty array of dependecies to ensure that
    // we only run the effect once after initial render
    }, []) 

    return null
}


const Lazy:React.FC<{loading:React.ReactNode,component:() => Promise<{default:React.ComponentType}>}> = ({ loading,component }) => {
    const RC = lazy(component) 
    return h(Suspense,{ fallback: loading },h(RC))
}
    
export {
    Lazy,
    Redirect,
    Switch,
    useLeaveGuard,
    connectGuard,
    Link,
    useRouter,
    useLocation,
    useRoute,
    useNestRoute,
    Router,
    Route,
    setRouteMode,
    routeMode,
    RouteMode
}