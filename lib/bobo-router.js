'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var react = require('react');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

const RouterCtx = react.createContext({});

let INIT_PATCH_HISTORY_EVENT = 0;
const useLocation = ({ base = "" } = {}) => {
    // only update component
    const [path, update] = react.useState(getCurrentPathname(base));
    const prevPath = react.useRef(path);
    const globalRef = react.useRef(react.useContext(RouterCtx).v);
    react.useEffect(() => {
        const checkUpdate = () => {
            let curPath = getCurrentPathname(base);
            // globalRef.current.prevPath = prevPath.current
            prevPath.current !== curPath && update((prevPath.current = curPath));
        };
        INIT_PATCH_HISTORY_EVENT || (INIT_PATCH_HISTORY_EVENT = 1, patchHistoryEvent(globalRef.current));
        const subscribeEvent = ['replaceState', 'pushState', 'popState'];
        subscribeEvent.forEach((event) => {
            addEventListener(event, checkUpdate);
        });
        // checkUpdate()
        return () => {
            subscribeEvent.forEach((event) => {
                removeEventListener(event, checkUpdate);
            });
        };
    }, [base]);
    const navigate = react.useCallback((url, type = "to") => {
        history[type == "replace" ? "replaceState" : "pushState"](0, '0', base + url, path);
    }, []);
    return [path, navigate];
};
function patchHistoryEvent(globalRef) {
    ['replaceState', 'pushState'].forEach((event) => {
        const ORIGINAL_EVENT = history[event];
        history[event] = function (state, title, to, path) {
            // route guard
            let isNavigate = false;
            if (to) {
                let beforeLeaveGuards = to !== path && globalRef.guardMap[JSON.stringify({ from: path, to })];
                // wait expose ... in component guard hooks
                // const beforeUpdateGuards = to == path && globalRef.guardMap[JSON.stringify({ from: path,to })]
                // const beforeEnterGuards = to !== path && globalRef.guardMap[JSON.stringify({ from: '*', to })]
                if (!beforeLeaveGuards) {
                    // fuzzy match for params case 
                    // eg: /url/:id
                    const matched = fuzzyMatchGuard(globalRef, to, path);
                    matched && (beforeLeaveGuards = globalRef.guardMap[matched[0]]);
                    if (!beforeLeaveGuards)
                        isNavigate = true;
                }
                if (beforeLeaveGuards) {
                    beforeLeaveGuards(() => isNavigate = true);
                }
            }
            // one step: emit route guard
            if (!isNavigate)
                return null;
            //two step: call histroy api to make location.pathname update
            const result = ORIGINAL_EVENT.apply(this, [state, title, to]);
            // three step: call subscriber
            const subscribe_event = new CustomEvent(event, { detail: { to, path } });
            dispatchEvent(subscribe_event);
            return result;
        };
    });
}
function getCurrentPathname(base, pathname = location.pathname) {
    // from basepath
    return !pathname.indexOf(base) ? pathname.slice(base.length) || '/' : pathname;
}
function fuzzyMatchGuard(globalRef, to, from = '*') {
    const matcher = globalRef.matcher;
    const registeredGuardKeys = Object.keys(globalRef.guardMap);
    let params = null;
    const matched = registeredGuardKeys.find((guardGroupStr) => {
        const guardGroup = JSON.parse(guardGroupStr);
        if (guardGroup['from'] == from) {
            let result;
            if ((result = matcher(guardGroup['to'], to))[0]) {
                params = result[1];
                return true;
            }
        }
    });
    return [matched, params];
}

// eslint-disable-next-line
function makeMatcher(makeRegexpFn = pathToRegexp) {
    let cache = {};
    // obtains a cached regexp version of the pattern
    const getRegexp = pattern => (cache[pattern]) || (cache[pattern] = makeRegexpFn(pattern));
    return (pattern, path) => {
        const { regexp, keys } = getRegexp(pattern || "");
        const out = regexp.exec(path);
        if (!out)
            return [false, null];
        // formats an object with matched params
        const params = keys.reduce((params, key, i) => {
            params[key.name] = out[i + 1];
            return params;
        }, {});
        return [true, params];
    };
}
const escapeRx = str => str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
const rxForSegment = (repeat, optional, prefix) => {
    let capture = repeat ? "((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*)" : "([^\\/]+?)";
    if (optional && prefix)
        capture = "(?:\\/" + capture + ")";
    return capture + (optional ? "?" : "");
};
const pathToRegexp = pattern => {
    const groupRx = /:([A-Za-z0-9_]+)([?+*]?)/g;
    let match = null, lastIndex = 0, keys = [], result = "";
    while ((match = groupRx.exec(pattern)) !== null) {
        const [_, segment, mod] = match;
        const repeat = mod === "+" || mod === "*";
        const optional = mod === "?" || mod === "*";
        const prefix = optional && pattern[match.index - 1] === "/" ? 1 : 0;
        const prev = pattern.substring(lastIndex, match.index - prefix);
        keys.push({ name: segment });
        lastIndex = groupRx.lastIndex;
        result += escapeRx(prev) + rxForSegment(repeat, optional, prefix);
    }
    result += escapeRx(pattern.substring(lastIndex));
    return { keys, regexp: new RegExp("^" + result + "(?:\\/)?$", "i") };
};

const useActionEffect = (action, deps) => {
    const depRef = react.useRef();
    if (isEqual(depRef.current, deps))
        return;
    action();
    depRef.current = deps;
};
function is(x, y) {
    if (x === y) {
        return x !== 0 || y !== 0 || 1 / x === 1 / y;
    }
    else {
        return x !== x && y !== y;
    }
}
function isEqual(old, cur) {
    if (is(old, cur))
        return true;
    if (typeof old !== 'object' || typeof cur !== 'object')
        return false;
    const oldKeys = Object.keys(old);
    const curKeys = Object.keys(cur);
    if (oldKeys.length !== curKeys.length)
        return false;
    // plain object or array
    curKeys.forEach((key) => {
        if (cur[key] !== old[key])
            return false;
    });
    return true;
}

const buildRouter = ({ base = "", matcher = makeMatcher(), guardMap = {}, prevPath = "" } = {}) => ({ base, matcher, guardMap, prevPath });
const useRouter = () => {
    const globalRef = react.useContext(RouterCtx);
    // either obtain the router from the outer context (provided by the
    // `<Router /> component) or create an implicit one on demand.
    return globalRef.v || (globalRef.v = buildRouter());
};
const useLocation$1 = () => {
    const router = useRouter();
    return useLocation(router);
};
const useRoute = (pattern) => {
    const [path, navigate] = useLocation$1();
    return [useRouter().matcher(pattern, path), path, navigate];
};
const useNestRoute = (pattern, prevMatchObject) => {
    const [path, navigate] = useLocation$1();
    const matcher = useRouter().matcher;
    const match_paths = path.split('/');
    let useRouteMatch = [false, {}];
    // avoid '/' Component show in any router
    for (let i = 1, base = "/"; i < match_paths.length; i++) {
        let curPath = base + match_paths[i];
        const result = matcher(pattern, curPath);
        if (result[0]) {
            if (prevMatchObject) {
                if (prevMatchObject.path !== curPath) {
                    prevMatchObject.path = curPath;
                    prevMatchObject.timer++;
                    prevMatchObject.prevParams = result[1];
                }
            }
            useRouteMatch = result;
            break;
        }
        base += match_paths[i] + '/';
    }
    useRouteMatch[0] || prevMatchObject && (prevMatchObject.timer = 0, prevMatchObject.prevParams = {});
    return [useRouteMatch, path, navigate];
};

const getParams = (isExact, pattern, ...params) => {
    const current_params = isExact ? useRoute(pattern)[0][1] : useNestRoute(pattern)[0][1];
    const result = {};
    for (let param of params) {
        result[param] = current_params[param];
    }
    return result;
};

const buildRouter$1 = ({ base = "", matcher = makeMatcher(), guardMap = {}, prevPath = "" } = {}) => ({ base, matcher, guardMap, prevPath });
const useRouter$1 = () => {
    const globalRef = react.useContext(RouterCtx);
    // either obtain the router from the outer context (provided by the
    // `<Router /> component) or create an implicit one on demand.
    return globalRef.v || (globalRef.v = buildRouter$1());
};
const useLocation$2 = () => {
    const router = useRouter$1();
    return useLocation(router);
};
const useRoute$1 = (pattern) => {
    const [path, navigate] = useLocation$2();
    return [useRouter$1().matcher(pattern, path), path, navigate];
};
const useNestRoute$1 = (pattern, prevMatchObject) => {
    const [path, navigate] = useLocation$2();
    const matcher = useRouter$1().matcher;
    const match_paths = path.split('/');
    let useRouteMatch = [false, {}];
    // avoid '/' Component show in any router
    for (let i = 1, base = "/"; i < match_paths.length; i++) {
        let curPath = base + match_paths[i];
        const result = matcher(pattern, curPath);
        if (result[0]) {
            if (prevMatchObject) {
                if (prevMatchObject.path !== curPath) {
                    prevMatchObject.path = curPath;
                    prevMatchObject.timer++;
                    prevMatchObject.prevParams = result[1];
                }
            }
            useRouteMatch = result;
            break;
        }
        base += match_paths[i] + '/';
    }
    useRouteMatch[0] || prevMatchObject && (prevMatchObject.timer = 0, prevMatchObject.prevParams = {});
    return [useRouteMatch, path, navigate];
};
/*
 * Router API: Router, Route, Link, Switch
 */
const Router = props => {
    const ref = react.useRef(null);
    // only in first render to call buildRouter
    const value = ref.current || (ref.current = { v: buildRouter$1(props) });
    return react.createElement(RouterCtx.Provider, {
        value: value,
        children: props.children
    });
};
const Route = ({ path, match, component, children, enterGuard, updateGuard, exact = false, isAlive }) => {
    const updateParamsRef = react.useRef({ path: "", timer: 0, prevParams: {} });
    const prevParams = updateParamsRef.current.prevParams;
    const [useRouteMatch, basePath, navigate] = !exact ? useNestRoute$1(path, updateParamsRef.current) : useRoute$1(path);
    const globalCtx = useRouter$1();
    useActionEffect(() => {
        if (!enterGuard)
            return;
        let guardGroup = JSON.stringify({ from: '*', to: path });
        globalCtx.guardMap[guardGroup] = (params, next) => enterGuard(params, navigate, next);
    }, [enterGuard]);
    // `props.match` is present - Route is controlled by the Switch
    const [matches, params] = match && match(path, basePath) || useRouteMatch;
    // if (!matches) return null
    if (!matches) {
        if (!isAlive)
            return null;
        else
            return renderChild({ display: 'none' });
    }
    // beforeEnter | beforeUpdate guard
    globalCtx.prevPath = basePath;
    let isEnter = false;
    let Execute_Guard_Type;
    (function (Execute_Guard_Type) {
        Execute_Guard_Type[Execute_Guard_Type["None"] = 0] = "None";
        Execute_Guard_Type[Execute_Guard_Type["Update"] = 1] = "Update";
        // If not in exact mode. However should execute update instead enter
        Execute_Guard_Type[Execute_Guard_Type["Update_UnResolve"] = 2] = "Update_UnResolve";
        Execute_Guard_Type[Execute_Guard_Type["Enter"] = 3] = "Enter";
    })(Execute_Guard_Type || (Execute_Guard_Type = {}));
    let execute_guard_type = Execute_Guard_Type.None;
    // judge execute RouteGuard Type
    // Type: Update | Enter 
    // emit UpdateGuard
    if (updateParamsRef.current.timer > 1) {
        // only emit UpdateGuard in unExact Mode 
        if (!exact) {
            if (updateGuard) {
                const next = () => isEnter = true;
                updateGuard(prevParams, updateParamsRef.current.prevParams, navigate, next);
            }
            else
                isEnter = true;
            execute_guard_type = Execute_Guard_Type.Update;
        }
        else
            execute_guard_type = Execute_Guard_Type.Update_UnResolve;
    }
    if (execute_guard_type == Execute_Guard_Type.None) {
        const from = '*';
        const guardGroup = JSON.stringify({ from: from, to: basePath });
        const executeGuards = globalCtx.guardMap[guardGroup];
        if (executeGuards) {
            executeGuards(null, () => isEnter = true);
        }
        else {
            const matched = fuzzyMatchGuard(globalCtx, basePath);
            if (matched[0]) {
                const fuzzyExecuteGuard = globalCtx.guardMap[matched[0]];
                fuzzyExecuteGuard(matched[1], () => isEnter = true);
            }
            else
                isEnter = true;
        }
    }
    if (!isEnter)
        return null;
    return renderChild();
    function renderChild(extraProps) {
        // React-Router style `component` prop
        if (component)
            return react.createElement(component, Object.assign({ params }, extraProps));
        // support render prop or plain children
        return typeof children === "function" ? react.cloneElement(children(params), extraProps) : react.cloneElement(children, extraProps);
    }
};
const useLeaveGuard = (props) => {
    const [curPath, navigate] = useLocation();
    const { path = curPath, resolve, to, type } = props;
    // type : 'beforeLeave' | 'beforeEnter'
    const globalRef = react.useContext(RouterCtx);
    react.useEffect(() => {
        let realPath = path;
        // call useGuard in FC 
        // first render is not effected
        if (type == 'beforeEnter')
            realPath = '*';
        const currentGuardFlagGroup = JSON.stringify({ from: realPath, to });
        globalRef.v.guardMap[currentGuardFlagGroup] = next => resolve(navigate, next);
    }, [path, resolve, to]);
};
const connectGuard = (type, resolve, from, to) => (Component) => {
    return (props) => {
        const { children } = props, others = __rest(props, ["children"]);
        const matcher = useRouter$1().matcher;
        const globalRef = react.useContext(RouterCtx);
        const { prevPath } = globalRef.v;
        const [curPath, navigate] = useLocation();
        let isRender = 0;
        const next = () => {
            isRender = 1;
        };
        if (type === 'beforeEnter') {
            if (from === '*' || matcher(from, prevPath)[0]) {
                resolve(prevPath, navigate, next);
            }
        }
        if (isRender)
            return react.createElement(Component, others, children);
        return react.createElement('div');
    };
};
const Link = props => {
    const [, navigate] = useLocation$2();
    const { base } = useRouter$1();
    const href = props.href || props.to;
    const { children, onClick } = props;
    const handleClick = react.useCallback(event => {
        if (event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.shiftKey ||
            event.button !== 0)
            return;
        event.preventDefault();
        navigate(href);
        onClick && onClick(event);
    }, [href, onClick, navigate]);
    // default render 'a' component
    const extraProps = { href: base + href, onClick: handleClick, to: null };
    const jsx = react.isValidElement(children) ? children : react.createElement("a", props);
    return react.cloneElement(jsx, extraProps);
};
const Switch = ({ children, location }) => {
    const { matcher } = useRouter$1();
    const [originalLocation] = useLocation$2();
    children = Array.isArray(children) ? children : [children];
    for (const element of children) {
        let match;
        if (react.isValidElement(element) &&
            // this allows to use different components that wrap Route
            // inside of a switch, for example <AnimatedRoute />.
            (match = element.props['path']
                ? matcher(element.props['path'], location || originalLocation)
                : [false, {}])[0])
            return react.cloneElement(element, { match, path: element.props['path'] });
    }
    // eslint-disable-next-line
    console.warn(`
        Switch component has no suitable render element;
        please check path prop
    `);
    return null;
};
const Redirect = props => {
    const [, push] = useLocation$2();
    react.useLayoutEffect(() => {
        // layout has finished 
        // replace url to new 
        push("replace", props.href || props.to);
        // we pass an empty array of dependecies to ensure that
        // we only run the effect once after initial render
    }, []);
    return null;
};
const Lazy = ({ loading, component }) => {
    const RC = react.lazy(component);
    return react.createElement(react.Suspense, { fallback: loading }, react.createElement(RC));
};

exports.Lazy = Lazy;
exports.Link = Link;
exports.Redirect = Redirect;
exports.Route = Route;
exports.Router = Router;
exports.Switch = Switch;
exports.connectGuard = connectGuard;
exports.default = useRoute$1;
exports.getParams = getParams;
exports.useLeaveGuard = useLeaveGuard;
exports.useLocation = useLocation$2;
exports.useNestRoute = useNestRoute$1;
exports.useRoute = useRoute$1;
exports.useRouter = useRouter$1;
//# sourceMappingURL=bobo-router.js.map