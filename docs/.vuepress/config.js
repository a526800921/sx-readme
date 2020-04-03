module.exports = {
    base: '/sx-readme/',
    title: '项目文档',
    description: '项目文档',
    port: 8080,
    configureWebpack: {
        resolve: {
            alias: {
                // '@alias': 'path/to/some/dir'
            }
        }
    },
    markdown: {
        lineNumbers: false, // 是否展示代码块行号
    },
    themeConfig: {
        displayAllHeaders: false,
        sidebar: [
            // ['/', '开始'],
            ['/guide/', '指南'],
            ['/npm/', 'npm包'],
            ['/h5/', 'H5'],
            ['/mp/', '小程序'],
            ['/kyy/', '快应用'],
            ['/other/', '其他'],
        ],
        lastUpdated: '最后更新',
        smoothScroll: true,
    }
}