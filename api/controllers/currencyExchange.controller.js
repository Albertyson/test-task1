'use strict';
const _ = require('lodash');
const moment = require('moment');
const http = require('http');
//wsEntryPoint/resource/flowRef/key?parameters";
/*
	@sends {
		base: "",
		date: "MM-DD-YYYY",
		rates: {}
	}

	{
		base: "",
		versus: "",
		date: "MM-DD-YYYY",
		rate: ""
	}
*/
exports.latest = (req, res) => {
	var url = getURL(req.params,req.query);
	console.log(url);
	callRequest(req,res,url,false);
};
/*
	@sends {
		base: "",
		versus: "",
		start: "MM-DD-YYYY",
		end: "MM-DD-YYYY",
		rates: {}
	}
	{
		base: "",
		versus: "",
		date: "MM-DD-YYYY",
		rate: ""
	}
*/
exports.historical = (req, res) => {
	var url = getURL(req.params,req.query);
	console.log(url);
	callRequest(req,res,url,true);
};
function getURL(params,query){
	var latest = new Date();
	latest.setMonth(latest.getMonth()-1);
	var latestFormated = moment(latest).format('YYYY-MM-DD');
	var url = `http://sdw-wsrest.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A`;
	if(params.base && params.versus === 'EUR'){
		url = `http://sdw-wsrest.ecb.europa.eu/service/data/EXR/D.${params.base}+${params.versus}.EUR.SP00.A`;
	}
	var startDate = '';
	var endDate = '';
	if(query.start && query.end){
		startDate = moment(query.start,'MM-DD-YYYY').format('YYYY-MM-DD');
		endDate = moment(query.end,'MM-DD-YYYY').format('YYYY-MM-DD');
	}
	if(query.date){
		startDate = moment(query.date,'MM-DD-YYYY').format('YYYY-MM-DD');
		endDate = moment(query.date,'MM-DD-YYYY').format('YYYY-MM-DD');
	}
	var parameters = [];
	if(startDate !== ''){
		parameters.push(`startPeriod=${startDate}`);
	}
	if(endDate !== ''){
		parameters.push(`endPeriod=${endDate}`);
	}
	parameters.push('detail=dataonly');
	if(startDate === "" && endDate === ""){
		parameters.push(`updatedAfter=${latestFormated}`);
	}
	url += `?${parameters.join('&')}`;
	return url;
}
function callRequest(req,res,url,fromHistory){
	var request = http.request(url, function (r) {
	    var data = '';
	    r.on('data', function (chunk) {
	        data += chunk;
	    });
	    r.on('end', function () {
	    	toJSON(data,function(json){
	    		var processedResponse = processResponse(req,json,fromHistory);
	    		res.jsonp(processedResponse);
	    		// res.status(200).send(processedResponse); 
	    	});
	        
			request.end();
	    });
	});
	request.on('connected',function(res){
		request.end();
	});
	request.on('error', function (e) {
	    request.end();
	});
	request.end();
};
function toJSON(xml,callback){
	const parseString = require('xml2js').parseString;
	return parseString(xml,function(err,result){
		callback(result);
	});
}
function processResponse(req,json,fromHistory){
	var response = {};
	var source = req.params.currency;
	if(req.params.base){
		source = req.params.base;
	}
	var currencyMap = getCurrencyMap(json,fromHistory);
	var rates = {};
	var ratesByDate = {};
	// response.currencyMap = currencyMap;
	if(fromHistory){
		_.forEach(currencyMap.mapByDate,function(cByDate,dKey){
			ratesByDate[moment(dKey,'YYYY-MM-DD').format('MM-DD-YYYY')] = convertCurrency(cByDate,source,req.params.versus);
		});
	}else{
		_.forEach(currencyMap.map,function(cValue,cKey){
			// if(cKey !== source){
				rates[cKey] = convertCurrency(currencyMap.map,source,cKey);
			// }
		});
	}
	response.base = source;
	response.versus = req.params.versus;
	response.date = moment().format('MM-DD-YYYY');
	if(req.query.start){
		delete response.date;
		response.start = moment(req.query.start,'MM-DD-YYYY').format('MM-DD-YYYY');
	}
	if(req.query.end){
		delete response.date;
		response.end = moment(req.query.end,'MM-DD-YYYY').format('MM-DD-YYYY');
	}
	if(req.query.date){
		response.date = moment(req.query.date,'MM-DD-YYYY').format('MM-DD-YYYY');
	}
	response.rate = rates[req.params.versus];
	if(req.params.currency){
		response.rates = rates;
	}
	if(fromHistory){
		if(req.query.date){
			response.rate = ratesByDate[response.date];
		}else{
			response.rates = ratesByDate;
		}
		
	}
	return response;
};
function getCurrencyMap(parsedJson,fromHistory){
	var currencyList = _.get(parsedJson,'message:GenericData.message:DataSet[0].generic:Series');
	var response = {
		map: {EUR:"1"},
		mapByDate: {}
	};
	response.currencyList = currencyList;
	_.forEach(currencyList,function(cObject){
		var seriesKeyList = _.get(cObject,'generic:SeriesKey[0].generic:Value');
		var currency = _.find(seriesKeyList,function(a){
			return _.get(a,'$.id') === "CURRENCY";
		});
		if(fromHistory){
			var observations = _.get(cObject,'generic:Obs');
			_.forEach(observations,function(obsObject){
				var dt = _.get(obsObject,'generic:ObsDimension[0].$.value');
				var vl = _.get(obsObject,'generic:ObsValue[0].$.value');
				response.mapByDate[dt] = response.mapByDate[dt] || {EUR:"1"};
				response.mapByDate[dt][_.get(currency,'$.value')] = vl; 
			});
		}else{
			var genericObs = _.get(cObject,'generic:Obs');
			var value = _.get(cObject,`generic:Obs[${genericObs.length - 1}].generic:ObsValue[0].$.value`);
			response.map[_.get(currency,'$.value')] = value;
		}		
	});
	return response;
}
function convertCurrency(map, source, target){
	var sourceValue = map[source];
	var targetValue = map[target];
	return Number(Number(targetValue / sourceValue).toFixed(4));
};