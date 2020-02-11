import { useRef } from 'react'

export const useActionEffect = (action:Function,deps:unknown[]) => {
    const depRef = useRef<unknown[]>()
    if(isEqual(depRef.current,deps)) return
    
    action()
    depRef.current = deps
}

function is(x:unknown, y:unknown) {
    if (x === y) {
        return x !== 0 || y !== 0 || 1 / x === 1 / y
    } else {
        return x !== x && y !== y
    }
}
  
function isEqual(old,cur) {
    if(is(old,cur)) return true
    if(typeof old !== 'object' || typeof cur !== 'object') return false

    const oldKeys = Object.keys(old)
    const curKeys = Object.keys(cur)
    
    if(oldKeys.length !== curKeys.length) return false
    // plain object or array
    curKeys.forEach((key) => {
        if(cur[key] !== old[key]) return false
    })
    return true
}