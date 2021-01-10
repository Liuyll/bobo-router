enum RouteMode {
    history,
    hash
}

let routeMode = RouteMode.history
const setRouteMode = (mode: RouteMode) => {
    routeMode = mode
}

export {
    routeMode,
    RouteMode,
    setRouteMode
}