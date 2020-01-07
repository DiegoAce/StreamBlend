'use strict';

const {LOG} = require('./log');

module.exports = {
    
    objectEmpty: (obj) =>
    {
        return Object.keys(obj).length === 0;
    },
    
    abbreviateNumber: (num, fixed) =>
    {
        if (num === null) { return null; } // terminate early
        if (num === 0) { return '0'; } // terminate early
        fixed = (!fixed || fixed < 0) ? 0 : fixed; // number of decimal places to show
        var b = (num).toPrecision(2).split("e"), // get power
            k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3), // floor at decimals, ceiling at trillions
            c = k < 1 ? num.toFixed(0 + fixed) : (num / Math.pow(10, k * 3) ).toFixed(1 + fixed), // divide by power
            d = c < 0 ? c : Math.abs(c), // enforce -0 is 0
            e = d + ['', 'K', 'M', 'B', 'T'][k]; // append power
        return e;
    },
    
    unabbreviateNumber: (value) =>
    {
        if (!value)
            return 0;
        if (typeof value === 'string' && value.length > 0)
            for (const [i, suffix] of["K", "M", "B", "T"].entries())
                if (value.charAt(value.length - 1) === suffix || value.charAt(value.length - 1) === suffix.toLowerCase())
                    return Number(value.substr(0, value.length - 1)) * Math.pow(10, i * 3 + 3);
        return Number(value);
    },
    
    insertAfter: (el, referenceNode) =>
    {
        referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
    },
    
    insertChildAtIndex: (el, parentNode, index) =>
    {
        parentNode.insertBefore(el, parentNode.childNodes[index]); //an index greater than childNodes length returns undefined causing insertBefore to insert at end as desired
    },
    
    getUrlParam: (url, param) =>
    {
        let u = new URL(url);
        let urlParam = u.searchParams.get(param);
        if (urlParam != null)
            return urlParam;
        let hash = u.hash.substr(1);
        let hashParams = hash.split('&').reduce(function (result, item) {
            var parts = item.split('=');
            result[parts[0]] = parts[1];
            return result;
        }, {});
        if (param in hashParams)
            return hashParams[param];
        return null;
    },
    
    getUrl: (url, params) =>
    {
        return module.exports.objectEmpty(params) ? url : (url + '?' + new URLSearchParams(params));
    },
    
    runFetch: (url, method, params, headers, callback) =>
    {
        DEBUG(LOG('fetch', url, params, headers));
        fetch(url, {...params, ...{method: method, headers: {...headers, ...{'Accept': 'application/json', 'Content-Type': 'application/json'}}}})
        .then((res) =>
        {
            let error = res.status < 200 || res.status >= 399;
            res.json()
            .then((res) => { callback(res, error); })
            .catch((error) => { callback(error, false); });
        })
        .catch((error) =>{ callback(error, true); });
    },
    
    fetchGet: (url, params, headers, callback) =>
    {
        module.exports.runFetch(module.exports.getUrl(url, params), 'GET', {}, headers, callback);
    },
    
    fetchPost: (url, params, headers, callback) =>
    {
        module.exports.runFetch(url, 'POST', {body: JSON.stringify(params)}, headers, callback);
    },
    
    fetchHtml: (url, params, callback) =>
    {
        DEBUG(LOG('fetchHtml', url, params));
        fetch(url, params)
        .then((res) =>
        {
            let error = res.status < 200 || res.status >= 399;
            res.text()
            .then((res) => { callback(res, error); })
            .catch((error) => { callback(error, false); });
        })
        .catch((error) => { callback(error, true); });
    },
    
}
