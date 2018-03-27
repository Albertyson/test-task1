var express = require('express');
var app = express();
var port = process.env.PORT ? process.env.PORT : 3000;

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var cors = require('cors');
app.use(cors());

var routes = require('./api/routes/currencyExchange.route');
routes(app);
app.listen(port);
app.disable('etag');

console.info('Currency Exchange RESTful API server started on: ' + port);