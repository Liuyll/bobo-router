import { useLocation as useLocationHook,navigate,fuzzyMatchGuard }  from './useLocation'
import makeMatcher from "../matcher.js"
import { useActionEffect } from './tools'

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
    lazy
} from "react"

import { RouterCtx,store,isMatch,params,matchFn } from './context'
export { getParams } from './helper'
/*
 * Part 1, Hooks API: useRouter, useRoute and useLocation
 */

// one of the coolest features of `createContext`:
// when no value is provided — default object is used.
// allows us to use the router context as a global ref to store
// the implicitly created router (see `useRouter` below)

type RouteProps = {
    path:string,
    match ?: matchFn
    enterGuard ?: EnterRouteGuard,
    updateGuard ?: UpdateRouteGuard,
    component ?: React.FC | React.ComponentClass,
    exact ?: boolean
} 

type updateGuardStruct = {
    timer:number;
    path:string;
    prevParams:params;
}

interface RouterGuard {
    path ?: string,
    to:string,
    resolve:(navigate:navigate,next:Function) => void,
    type:"beforeLeave" | "beforeEnter"
} 

interface EnterRouteGuard {
    resolve:(params:any,navigate:navigate,next:Function) => void,
    path:string
}

interface UpdateRouteGuard {
    (beforeParams:params,currentParams:params,navigate:Function,next:Function):void
}
const buildRouter = ({
    base = "",
    matcher = makeMatcher(),
    guardMap = {},
    prevPath = ""
}:store['v'] = {} as store['v']) => ({ base, matcher,guardMap,prevPath })

export const useRouter = () => {
    const globalRef = useContext(RouterCtx)

    // either obtain the router from the outer context (provided by the
    // `<Router /> component) or create an implicit one on demand.
    return globalRef.v || (globalRef.v = buildRouter())
}

export const useLocation = () => {
    const router = useRouter()
    return useLocationHook(router)
}

export const useRoute = (pattern:RegExp | string):[[isMatch,params],string,(type:"replace" | "to",url:string) => void] => {
    const [path,navigate] = useLocation()
    return [useRouter().matcher(pattern, path),path,navigate]
}

export const useNestRoute = (pattern:RegExp | string,prevMatchObject?:updateGuardStruct):[[isMatch,params],string,(type:"replace" | "to",url:string) => void] => {
    const [path,navigate] = useLocation()
    const matcher = useRouter().matcher

    const match_paths = path.split('/')
    let useRouteMatch:[isMatch,params] = [false,{}]

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
            useRouteMatch = result
            break
        }
        base += match_paths[i] + '/'
    }
    useRouteMatch[0] || prevMatchObject && (prevMatchObject.timer = 0,prevMatchObject.prevParams = {})
    return [useRouteMatch,path,navigate]
}

/*
 * Part 2, Low Carb Router API: Router, Route, Link, Switch
 */

export const Router = props => {
    const ref = useRef<null | store>(null)

    // only in first render to call buildRouter
    const value = ref.current || (ref.current = { v: buildRouter(props) })

    return h(RouterCtx.Provider, {
        value: value,
        children: props.children
    })
}

export const Route:React.FC<RouteProps> = ({ path, match, component, children, enterGuard,updateGuard,exact = false }) => {
    const updateParamsRef = useRef<updateGuardStruct>({ path: "",timer: 0,prevParams: {} })
    const prevParams = updateParamsRef.current.prevParams
    const [useRouteMatch,basePath,navigate] = !exact ? useNestRoute(path,updateParamsRef.current) : useRoute(path)
    const globalCtx = useRouter()

    useActionEffect(() => {
        if(!enterGuard) return
        let guardGroup = JSON.stringify({ from: '*',to: enterGuard.path })
        globalCtx.guardMap[guardGroup] = (params,next) => enterGuard.resolve(params,navigate,next)
    },[enterGuard])
    // `props.match` is present - Route is controlled by the Switch
    const [matches, params] = match && match(path,basePath) || useRouteMatch
    if (!matches) return null

    // beforeEnter | beforeUpdate guard
    
    const prevPath = globalCtx.prevPath
    globalCtx.prevPath = basePath

    let isEnter = false
    enum Execute_Guard_Type {
        None,
        Update,
        // If not in exact mode.However should execute update instead enter
        Update_UnResolve,
        Enter,
    }
    let execute_guard_type = Execute_Guard_Type.None
    // judge execute RouteGuard Type
    // Type: Update | Enter 
    // emit UpdateGuard

    if(updateParamsRef.current.timer > 1) {
        // only emit UpdateGuard in unExact Mode 
        if(!exact) {
            if(updateGuard) {
                const next = () => isEnter = true
                updateGuard(prevParams,updateParamsRef.current.prevParams,navigate,next)
            } else isEnter = true
            execute_guard_type = Execute_Guard_Type.Update
        }
        else execute_guard_type = Execute_Guard_Type.Update_UnResolve
    }

    if(execute_guard_type == Execute_Guard_Type.None) {
        const from = '*'

        const guardGroup = JSON.stringify({ from: from,to: basePath })
        const executeGuards = globalCtx.guardMap[guardGroup]  
 
        if(executeGuards) {
            executeGuards(null,() => isEnter = true) 
        } else {
            const matched = fuzzyMatchGuard(globalCtx,basePath)
            if(matched[0]) {
                const fuzzyExecuteGuard = globalCtx.guardMap[matched[0]]
                fuzzyExecuteGuard(matched[1],() => isEnter = true)
            }
            else isEnter = true
        }
    }

    if(!isEnter) return null
    // React-Router style `component` prop
    if (component) return h(component, { params } as any)

    // support render prop or plain children
    return typeof children === "function" ? children(params) : children
}

export const useGuard = (props:RouterGuard) => {
    const [curPath,navigate] = useLocationHook()
    const { path = curPath,resolve,to,type } = props
    // type : 'beforeLeave' | 'beforeEnter' | 'beforeUpdate'
    const globalRef = useContext(RouterCtx)
    
    useEffect(() => {  
        let realPath = path

        // call useGuard in FC 
        // first render is not effected
        if(type == 'beforeEnter') realPath = '*'
        const currentGuardFlagGroup = JSON.stringify({ from: realPath,to })
        
        globalRef.v.guardMap[currentGuardFlagGroup] = next => resolve(navigate,next)
    },[path,resolve,to])
}

export const Link = props => {
    const [, navigate] = useLocation()
    const { base } = useRouter()

    const href = props.href || props.to
    const { children, onClick } = props

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

    // default render 'a' component
    const extraProps = { href: base + href, onClick: handleClick, to: null }
    const jsx = isValidElement(children) ? children : h("a", props)

    return cloneElement(jsx, extraProps)
}

export const Switch = ({ children, location }) => {
    const { matcher } = useRouter()
    const [originalLocation] = useLocation()

    children = Array.isArray(children) ? children : [children]

    for (const element of children) {
        let match:[boolean,params]

        if (
            isValidElement(element) &&
      // we don't require an element to be of type Route,
      // but we do require it to contain a truthy `path` prop.
      // this allows to use different components that wrap Route
      // inside of a switch, for example <AnimatedRoute />.
      (match = element.props['path']
          ? matcher(element.props['path'], location || originalLocation)
          : [false, {}]
      )[0]
        )
            return cloneElement(element, { match,path: element.props['path'] } as any)
    }

    // eslint-disable-next-line
    console.warn(`
        Switch component has no suitable render element;
        please check path prop
    `)
    return null
}

export const Redirect = props => {
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


export const Lazy:React.FC<{loading:React.ReactNode,component:() => Promise<{default:React.ComponentType}>}> = ({ loading,component }) => {
    const RC = lazy(component) 
    return h(Suspense,{ fallback: loading },h(RC))
}
    

export default useRoute