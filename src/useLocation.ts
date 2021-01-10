import { useEffect,useState,useCallback,useRef,useContext } from 'react'
import { RouterCtx,store } from './context'
import { routeMode, RouteMode } from './mode'
import { useEventCallback } from './tools'
declare namespace history {
    function pushState(...p:any[]) : void
    function replaceState(...p:any[]) : void
    function popState(...p:any[]): void
}
type navigate = (url:string,type ?: "replace" | "to") => void
// to: '*' || from: '*' 
enum GuardKeyAny {
    to,
    from
}

const NOOP = () => {}
let INIT_PATCH_HISTORY_EVENT = 0
const useLocation = ({ base = "" } = {}):[string,navigate] => {
    // only update component
    const [path,update] = useState<string>(getCurrentPathname(base)) 
    const prevPath = useRef(path)
    const globalRef = useRef<store['v']>(useContext(RouterCtx).v as any as store['v'])

    const checkUpdate = useEventCallback(() => {
        let curPath = getCurrentPathname(base)
        // globalRef.current.prevPath = prevPath.current
        prevPath.current !== curPath && update((prevPath.current = curPath))
    },[base, update])

    useEffect(() => {
        INIT_PATCH_HISTORY_EVENT || (INIT_PATCH_HISTORY_EVENT = 1,patchHistoryEvent(globalRef.current))
        
        const historyModeSubscribeEvent = ['replaceState','pushState','popState']
        const hashModeSubscribeEvent = 'hashChange'
        // subscribe dep. wait emit...
        if(routeMode === RouteMode.history) historyModeSubscribeEvent.forEach((event) => {
            addEventListener(event,checkUpdate)
        }) 
        else if(routeMode === RouteMode.hash) addEventListener(hashModeSubscribeEvent, checkUpdate)

        // checkUpdate()
        return () => {
            if(routeMode === RouteMode.history) historyModeSubscribeEvent.forEach((event) => {
                removeEventListener(event,checkUpdate)
            }) 
            else removeEventListener(hashModeSubscribeEvent, checkUpdate)
        }
    },[base])

    const navigate:navigate = useCallback((url:string,type:"replace" | "to" = "to") => {
        // path handle by patchHistoryEvent: 4th param
        if(routeMode === RouteMode.history) history[type == "replace" ? "replaceState" : "pushState"](0,'0',base + url, path)
        else if(routeMode === RouteMode.hash) location.hash = base + url
    },[path])

    return [path,navigate]
}  

function patchHistoryEvent(globalRef:store['v']) {
    if(routeMode === RouteMode.history) {
        ['replaceState','pushState'].forEach((event) => {
            const ORIGINAL_EVENT = history[event]
            history[event] = function(state:any,title:string,to:string,path:string) {
                // leave guard: when false refuse navigate
                let _next = false
                const next = () => _next = true
                if(to) {
                    const [guardKey1, guardKey2] = generateGuardKeys(path, to)
                    let beforeLeaveGuard = to !== path && ( globalRef.leaveGuardMap[guardKey1] || globalRef.leaveGuardMap[guardKey2])  
                    
                    if(!beforeLeaveGuard) {
                        // fuzzy match for params case 
                        // eg: /url/:id
                        const matched = fuzzyMatchGuard(globalRef,to,path)
                        matched && (beforeLeaveGuard = globalRef.leaveGuardMap[matched[0]])
    
                        if(!beforeLeaveGuard) next()
                    }
                    if(beforeLeaveGuard) {
                        beforeLeaveGuard(next)
                    }
                }
    
                if(!_next) return null
                const result = ORIGINAL_EVENT.apply(this,[state,title,to])
                const subscribeEvent = new CustomEvent(event,{ detail: { to,path } })
                dispatchEvent(subscribeEvent)
              
                return result
            }
    
            window.onpopstate = () => {
                const from = globalRef.prevPath,
                    to = location.pathname
                const [guardKey1, guardKey2] = generateGuardKeys(from, to)
                let beforeLeaveGuards = from !== to && ( globalRef.leaveGuardMap[guardKey1] || globalRef.leaveGuardMap[guardKey2]) 
                // browser back action not refuse
                beforeLeaveGuards && beforeLeaveGuards(NOOP)
                
                const popEvent = new CustomEvent('popState')
                dispatchEvent(popEvent)
            }
        })
    }
    else if(routeMode === RouteMode.hash) {
        window.onhashchange = (event:HashChangeEvent) => {
            const [guardKey1, guardKey2] = generateGuardKeys(getHashFromHref(event.oldURL), getHashFromHref(event.newURL))
            let beforeLeaveGuard = event.oldURL !== event.newURL && (globalRef.leaveGuardMap[guardKey1] || globalRef.leaveGuardMap[guardKey2])
            beforeLeaveGuard && beforeLeaveGuard(() => {})

            const hashChangeEvent = new CustomEvent('hashChange')
            dispatchEvent(hashChangeEvent)
        }
    }
} 

function generateGuardKeys(from: string, to: string, any:GuardKeyAny = GuardKeyAny.to) {
    return [
        JSON.stringify({from, to}),
        any === GuardKeyAny.to ? JSON.stringify({from, to: '*'}) : JSON.stringify({from: '*', to})
    ]
}

function getCurrentPathname(base,pathname ?: string) {
    // from basepath
    if(routeMode === RouteMode.history) {
        pathname = location.pathname
        return !pathname.indexOf(base) ? pathname.slice(base.length) || '/' : pathname
    }
    else if(routeMode === RouteMode.hash) {
        return getHashFromHref(location.href)
    }
}

function getHashFromHref(path: string) {
    debugger
    const hashIndex = path.indexOf('#')
    if(!~hashIndex) path = '/'
    else path = path.slice(hashIndex + 1)
    
    return path
}

function fuzzyMatchGuard(globalRef:store['v'],to:string,from:string = '*', leaveGuardMap:string = "leaveGuardMap"):[string,any[]]{
    const matcher = globalRef.matcher
    const registeredGuardKeys = Object.keys(leaveGuardMap === 'leaveGuardMap' ? globalRef.leaveGuardMap : globalRef.enterGuardMap)

    let params = null
    const matched = registeredGuardKeys.find((guardGroupStr) => {
        const guardGroup = JSON.parse(guardGroupStr)
        if(guardGroup['from'] == from) {
            let result
            if((result = matcher(guardGroup['to'],to))[0]) {
                params = result[1]
                return true
            } 
        }
    })
    return [matched,params]
}

export {
    fuzzyMatchGuard,
    navigate,
    useLocation
}