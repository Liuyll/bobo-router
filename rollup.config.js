import typescript from "rollup-plugin-typescript"

export default {
    input: 'src/index.ts',
    output: [
        { name: 'bobo-router', file: 'lib/bobo-router.js', format: 'cjs', sourcemap: true },
        { name: 'bobo-router', file: 'lib/bobo-router.esm.js', format: 'umd', sourcemap: true }
    ],
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        })
    ]
}