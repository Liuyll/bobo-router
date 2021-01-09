import { useEffect,useState,useCallback,useRef,useContext } from 'react'
import { RouterCtx,store } from './context'

declare namespace history {
    function pushState(...p:any[]) : void
    function replaceState(...p:any[]) : void
    function popState(...p:any[]): void
}
type navigate = (url:string,type ?: "replace" | "to") => void

const NOOP = () => {}
let INIT_PATCH_HISTORY_EVENT = 0
const useLocation = ({ base = "" } = {}):[string,navigate] => {
    // only update component
    const [path,update] = useState<string>(getCurrentPathname(base)) 
    const prevPath = useRef(path)
    const globalRef = useRef<store['v']>(useContext(RouterCtx).v as any as store['v'])
   
    useEffect(() => {
        const checkUpdate = () => {
            let curPath = getCurrentPathname(base)
            // globalRef.current.prevPath = prevPath.current
            prevPath.current !== curPath && update((prevPath.current = curPath))
        }
        INIT_PATCH_HISTORY_EVENT || (INIT_PATCH_HISTORY_EVENT = 1,patchHistoryEvent(globalRef.current))
        
        const subscribeEvent = ['replaceState','pushState','popState']
        // subscribe dep. wait emit...
        subscribeEvent.forEach((event) => {
            addEventListener(event,checkUpdate)
        })

        // checkUpdate()
        return () => {
            subscribeEvent.forEach((event) => {
                removeEventListener(event,checkUpdate)
            })
        }
    },[base])

    const navigate:navigate = useCallback((url:string,type:"replace" | "to" = "to") => {
        history[type == "replace" ? "replaceState" : "pushState"](0,'0',base + url,path)
    },[])

    return [path,navigate]
}  

function patchHistoryEvent(globalRef:store['v']) {
    ;['replaceState','pushState'].forEach((event) => {
        const ORIGINAL_EVENT = history[event]
        history[event] = function(state:any,title:string,to:string,path:string) {
            // leave guard: when false refuse navigate
            let _next = false
            if(to) {
                const guardKey1 = JSON.stringify({ from: path,to }),
                    guardKey2 = JSON.stringify({from: path, to: '*'})
                let beforeLeaveGuard = to !== path && ( globalRef.leaveGuardMap[guardKey1] || globalRef.leaveGuardMap[guardKey2])  
                
                if(!beforeLeaveGuard) {
                    // fuzzy match for params case 
                    // eg: /url/:id
                    const matched = fuzzyMatchGuard(globalRef,to,path)
                    matched && (beforeLeaveGuard = globalRef.leaveGuardMap[matched[0]])

                    if(!beforeLeaveGuard) _next = true
                }
                if(beforeLeaveGuard) {
                    beforeLeaveGuard(() => _next = true)
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
            const guardKey1 = JSON.stringify({ from, to }),
                guardKey2 = JSON.stringify({from, to: '*'})
            let beforeLeaveGuards = from !== to && ( globalRef.leaveGuardMap[guardKey1] || globalRef.leaveGuardMap[guardKey2]) 
            // browser back action not refuse
            beforeLeaveGuards && beforeLeaveGuards(NOOP)
            
            const popEvent = new CustomEvent('popState')
            dispatchEvent(popEvent)
        }
        
    })
} 

function getCurrentPathname(base,pathname = location.pathname) {
    // from basepath
    return !pathname.indexOf(base) ? pathname.slice(base.length) || '/' : pathname
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