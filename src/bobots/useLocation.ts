import { useEffect,useState,useCallback,useRef,useContext } from 'react'
import { RouterCtx,store } from './context'

declare namespace history {
    function pushState(...p:any[]) : void
    function replaceState(...p:any[]) : void
}

export type navigate = (url:string,type ?: "replace" | "to") => void

let INIT_PATCH_HISTORY_EVENT = 0
export const useLocation = ({ base = "" } = {}):[string,navigate] => {
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
            // route guard
            let isNavigate = false
            if(to) {
                let beforeLeaveGuards = to !== path && globalRef.guardMap[JSON.stringify({ from: path,to })]   

                // wait expose ... in component guard hooks
                // const beforeUpdateGuards = to == path && globalRef.guardMap[JSON.stringify({ from: path,to })]
                // const beforeEnterGuards = to !== path && globalRef.guardMap[JSON.stringify({ from: '*', to })]
                
                if(!beforeLeaveGuards) {
                    // fuzzy match for params case 
                    // eg: /url/:id
                    const matched = fuzzyMatchGuard(globalRef,to,path)
                    matched && (beforeLeaveGuards = globalRef.guardMap[matched[0]])

                    if(!beforeLeaveGuards) isNavigate = true
                }
                if(beforeLeaveGuards) {
                    beforeLeaveGuards(() => isNavigate = true)
                }

            }

            // one step: emit route guard
            if(!isNavigate) return null

            //two step: call histroy api to make location.pathname update
            const result = ORIGINAL_EVENT.apply(this,[state,title,to])

            // three step: call subscriber
            const subscribe_event = new CustomEvent(event,{ detail: { to,path } })
            dispatchEvent(subscribe_event)
          
            return result
        }
        
    })
} 

function getCurrentPathname(base,pathname = location.pathname) {
    // from basepath
    return !pathname.indexOf(base) ? pathname.slice(base.length) || '/' : pathname
}

export function fuzzyMatchGuard(globalRef:store['v'],to:string,from:string = '*'):[string,any[]]{
    const matcher = globalRef.matcher
    const registeredGuardKeys = Object.keys(globalRef.guardMap)

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