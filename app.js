'use strict';

let bodyParser = require('body-parser');
let cookieParser = require('cookie-parser');
let express = require('express');
let logger = require('morgan');
let path = require('path');

let db = require('./helpers/db');
let utils = require('./helpers/utils');

let errorHandler = require('./modules/error-handler');
let scheduler = require('./modules/scheduler');

let rootApi = require('./routes/root-endpoint');
let chartsApi = require('./routes/charts');
let chartSetsApi = require('./routes/chart-sets');
let jobsApi = require('./routes/jobs');
let tasksApi = require('./routes/tasks');

let app = module.exports = express();

// CORS support
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  next();
});

// log trace in development mode
/* istanbul ignore if  */
if (app.get('env') === 'development') {
  app.use(logger('dev'));
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

// register routes
app.use('/api/v1', rootApi);
app.use('/api/v1', chartsApi);
app.use('/api/v1', chartSetsApi);
app.use('/api/v1', jobsApi);
app.use('/api/v1', tasksApi);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  let err = new Error();

  err.status = 404;

  next(err);
});

// only log the error trace in development mode
/* istanbul ignore if  */
if (app.get('env') === 'development') {

  app.use(function (err, req, res, next) {
    console.error(err);
    next(err);
  });
}

// error handler
app.use(errorHandler);

db.connect()
  .then(function () {
    scheduler.start();
  });
