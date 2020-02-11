import { createContext } from 'react'

export type isMatch = boolean
export type params = {[key:string]:any}
export type matchFn = (pattern:string | RegExp,path:string) => [isMatch,params]

export interface store {
    v:{
        base:string,
        guardMap:{[path:string]:Function},
        prevPath:string,
        matcher:matchFn,
    }, 
    [customData:string]:any
}

export const RouterCtx = createContext<store>({} as store)