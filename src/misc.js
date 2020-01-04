'use strict';

const {LOG} = require('./log');

module.exports = {
    
    objectEmpty: (obj) =>
    {
        return Object.keys(obj).length === 0;
    },
    
    abbreviateNumber: (value) =>
    {
        let newValue = value;
        if (value >= 1000) {
            let suffixes = ["", "K", "M", "B", "T"];
            let suffixNum = Math.floor(("" + value).length / 3);
            let shortValue = '';
            for (let precision = 2; precision >= 1; precision--) {
                shortValue = parseFloat((suffixNum != 0 ? (value / Math.pow(1000, suffixNum)) : value).toPrecision(precision));
                let dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
                if (dotLessShortValue.length <= 2)
                    break;
            }
            if (shortValue % 1 != 0)
                shortValue = shortValue.toFixed(1);
            newValue = shortValue + suffixes[suffixNum];
        }
        return newValue;
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
