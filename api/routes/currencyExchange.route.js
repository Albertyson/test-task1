'use strict';
module.exports = function(app) {
	var currencyExchange = require('../controllers/currencyExchange.controller');

	app.route('/latest/:base-:versus').get(currencyExchange.latest)

	app.route('/latest/:currency').get(currencyExchange.latest)

	app.route('/historical/:base-:versus').get(currencyExchange.historical)
};