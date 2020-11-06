import { useRoute,useNestRoute } from './index'

export const getParams = (isExact:boolean,pattern:RegExp | string,...params: string[]) => {
    const current_params = isExact ? useRoute(pattern)[0][1] : useNestRoute(pattern)[0][1]
    const result = {}
    for(let param of params) {
        result[param] = current_params[param]
    }
    return result
}