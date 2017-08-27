/**
 * Created by Yakima Teng on 2016/11/23.
 */
'use strict'
var gulp = require('gulp')
var proxy = require('http-proxy-middleware')
var gulpSequence = require('gulp-sequence')
var path = require('path')
var changed = require('gulp-changed')
var browserSync = require('browser-sync').create()

var less = require('gulp-less')
var LessAutoPrefix = require('less-plugin-autoprefix')
var autoPrefix = new LessAutoPrefix({
  browsers: ['last 20 versions']
})
var rename = require('gulp-rename')
var cleanCSS = require('gulp-clean-css')

var frontEndPort = 4000
var mockServerPort = 8083

const domain = {
  mock: 'http://127.0.0.1:' + mockServerPort,
  proxy: 'http://120.24.50.193:9080'
}

gulp.task('browser-sync', function () {
  browserSync.init({
    server: {
      baseDir: './',
      directory: true,
      routes: {
        '/wechat/static/onlinechat/dist': 'dist',
        '/wechat/static/onlinechat/party-demo': 'party-demo'
      }
    },
    port: frontEndPort,
    startPath: '/wechat/static/onlinechat/party-demo/index.html',
    middleware: [
      proxy('/test', { target: domain.proxy, changeOrigin: true })
    ]
  })

  gulp.watch([
    './dist/index.html',
    './dist/html/**/*.html',
    './dist/js/**/*.js',
    './dist/img/**/*.*'
  ]).on('change', function (event) {
    console.log('File ' + event.path + ' was ' + event.type + ', reloading now')
    browserSync.reload()
  })

  gulp.watch([
    './dist/less/**/*.less'
  ], ['less']).on('change', function (event) {
    console.log('File ' + event.path + ' was ' + event.type + ', transforming css now')
  })
})

gulp.task('less', function () {
  return gulp.src([
      './dist/less/*.less',
      './dist/less/font-awesome/font-awesome.less',
      '!./dist/less/utils.less'
    ])
    // 注意：使用gulp-changed会导致纯@import构成的less文件不会因为它import的文件的变动而重新编译
    // 所以，要么把下面这样注释掉，要么打开那个纯@import构成的less文件进行保存操作
    .pipe(changed('./dist/css', { extension: '.min.css' }))
    .pipe(less({
      paths: [path.join(__dirname, 'dist', 'less')],
      plugins: [autoPrefix]
    }))
    .on('error', function (e) { console.log(e) })
    .pipe(rename({ suffix: '.min' }))
    .pipe(cleanCSS({}))
    .pipe(gulp.dest('./dist/css'))
    .pipe(browserSync.stream())
})

gulp.task('mock-server', function () {
  var http = require('http')
  var fs = require('fs')
  var express = require('express')
  var app = express()
  app.all('*', function (req, res, next) {
    var apiPath = req.url
    var fileName = transferPathToFileName(apiPath)
    if (!fileName) {
      res.json({ error: 'fileName不存在' })
      return
    }
    var filePathAndName = path.join(__dirname, 'mock', fileName + '.json')
    fs.access(filePathAndName, fs.F_OK, function (err) {
      if (err) {
        if (err.code === 'ENOENT') {
          fs.writeFile(filePathAndName, '{}', function (error) {
            console.log(error ? filePathAndName + '文件创建失败！' : filePathAndName + '文件创建成功！')
          })
        } else {
          console.log(err)
        }
      } else {
        fs.readFile(filePathAndName, function (err, data) {
          if (err) {
            res.json(err)
            return
          }
          res.json(JSON.parse(data.toString()))
        })
      }
    })
  })
  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })
  // error handlers (will print stacktrace)
  app.use(function (err, req, res, next) {
    res.status(err.status || 500).json({
      message: err.message,
      error: err
    })
  })
  app.set('port', mockServerPort)
  var server = http.createServer(app)
  server.listen(mockServerPort)
  server.on('error', onError)
  server.on('listening', onListening)
  // Event listener for HTTP server "error" event.
  function onError (error) {
    if (error.syscall !== 'listen') {
      throw error
    }

    const bind = typeof mockServerPort === 'string'
      ? 'Pipe ' + mockServerPort
      : 'Port ' + mockServerPort

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges')
        process.exit(1)
        break
      case 'EADDRINUSE':
        console.error(bind + ' is already in use')
        process.exit(1)
        break
      default:
        throw error
    }
  }
  // translate '/a/b-d/c#d?q=hello' to 'a-b-d-c'
  function transferPathToFileName (pathValue) {
    if (!/^\/.*$/.test(pathValue)) {
      console.log('[PATH ERROR]: path should start with symbol '/' instead of your ' + pathValue)
      return false
    }
    return pathValue.split('#')[0].split(/^\//)[1].replace(/\//g, '-')
  }
  // Event listener for HTTP server "listening" event.
  function onListening () {
    const addr = server.address()
    const bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port

    console.log('[MAIN] Mock server listening on ' + bind)
  }
})

gulp.task('dev', gulpSequence('browser-sync', 'less', 'mock-server'))
