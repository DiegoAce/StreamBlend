'use strict';

const LOG = require('./log');

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
        let b = (num).toPrecision(2).split("e"), // get power
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
    
    updateMatchingObjects: (objects, matchKey, matchValue, updateData) =>
    {
        let matches = [];
        for (let o of objects)
            if (o[matchKey] === matchValue)
                matches.push(o);
        for (let o of matches)
            for (let key in updateData)
                o[key] = updateData[key];
    },
    
    getEnclosingBracketString: (str, index) =>
    {
        let i = index
        let brackets = 0;
        let start, end;
        while (i < str.length)
        {
            i++;
            if (str[i] === '{')
            {
                brackets++;
                if (brackets === 1)
                    start = i;
            }
            else if (str[i] === '}')
            {
                brackets--;
                if (brackets <= 0)
                {
                    end = i+1;
                    break;
                }
            }
        }
        return str.substring(start, end);
    },
    
    insertNodeAfter: (node, referenceNode) =>
    {
        referenceNode.parentNode.insertBefore(node, referenceNode.nextSibling);
    },
    
    insertChildNodeAtIndex: (childNode, parentNode, index) =>
    {
        parentNode.insertBefore(childNode, parentNode.childNodes[index]); //an index greater than childNodes length returns undefined causing insertBefore to insert at end as desired
    },
    
    getUrlParam: (url, param) =>
    {
        let u = new URL(url);
        let urlParam = u.searchParams.get(param);
        if (urlParam != null)
            return urlParam;
        let hash = u.hash.substr(1);
        let hashParams = hash.split('&').reduce(function (result, item) {
            let parts = item.split('=');
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
    
    runFetch: (url, method, params, headers) =>
    {
        return new Promise((resolve)=>
        {
            function FLOG(...args){ LOG('fetch', url, params, headers, ...args); }
            FLOG();
            fetch(url, {...params, ...{method: method, headers: {...headers, ...{'Accept': 'application/json', 'Content-Type': 'application/json'}}}})
            .then((res) =>
            {
                let error = res.status < 200 || res.status >= 400;
                res.json()
                .then((res) => { FLOG(res, error); resolve(error ? null : res); })
                .catch((error) => { FLOG(error); resolve(); });
            })
            .catch((error) =>{ FLOG(error); resolve(); });
        });
    },
    
    fetchGet: (url, params, headers) =>
    {
        return module.exports.runFetch(module.exports.getUrl(url, params), 'GET', {}, headers);
    },
    
    fetchPost: (url, params, headers) =>
    {
        return module.exports.runFetch(url, 'POST', {body: JSON.stringify(params)}, headers);
    },
    
    fetchHtml: (url, params) =>
    {
        return new Promise((resolve)=>
        {
            function FLOG(...args){ LOG('fetchHtml', url, params, ...args); }
            FLOG();
            fetch(url, params)
            .then((res) =>
            {
                let error = res.status < 200 || res.status >= 400;
                res.text()
                .then((res) => { FLOG(res, error); resolve(error ? null : res); })
                .catch((error) => { FLOG(error); resolve(); });
            })
            .catch((error) => { FLOG(error); resolve(); });
        });
    },
    
}
