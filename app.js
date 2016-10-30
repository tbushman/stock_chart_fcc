var fs = require('fs');
var express = require('express');
var path = require('path');
var _ = require('underscore');
var mongoose = require('mongoose');
var Promise = require('bluebird');
mongoose.Promise = Promise;
var session = require('express-session');
var MongoStore = require('connect-mongo')(session); //let connect-mongo access session
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var dotenv = require('dotenv');
var http = require('http');

dotenv.load();

var routes = require('./routes/index');

var User = require('./models/stocks');

var app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.set('view options', { layout: false });

app.locals.appTitle = "FCC Stock Chart";
//app.locals.data = app.session.data;
//app.locals.dots = app.session.dots;

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var uri = || process.env.MONGOLAB_URI || process.env.DEVDB;

mongoose.connect(uri, {authMechanism: 'ScramSHA1'});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var sess = {
  	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: false,
	cookie: {},
	store: new MongoStore({
		mongooseConnection: db
	})
}
app.use(cookieParser(sess.secret));
if (app.get('env') === 'production') {
	app.set('trust proxy', 1) // trust first proxy
}

app.use(session(sess))

app.use(express.static(__dirname + '/public'));

app.use('/', routes);

app.use(function (req, res, next){
	res.locals.data = req.session.data;
	res.locals.dots = req.session.dots;	
	res.locals.start_date = req.session.start_date;
	res.locals.end_date = req.session.end_date;
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('File Not Found');
	err.status = 404;
	next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// error handler
// define as the last app.use callback
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});



var port = process.env.PORT || 3001;

http.createServer(app).listen(port, function (err) {
	console.log('listening in http://localhost:' + port);
});

