'use strict';

const {LOG} = require('./log');
const Keys = require('./keys');
const Constants = require('./constants');
const Misc = require('./misc');

class Follow
{
    constructor(obj)
    {
        this.userName = '';
        this.activityName = '';
        this.avatarUrl = '';
        this.online = false;
        this.viewerCount = 0;
        this.link = '';
        for (let key in obj)
          this[key] = obj[key];
    }
}

class Agent
{
    constructor()
    {
        this.name;
        this.accessToken;
        this.refreshToken;
        this.expiration;
        this.clientSecret = '';
        this.scope = '';
        this.follows = [];
        this.timeFollowsRefreshed;
        this.error = '';
    }
    authAccessTokenName() { return this.name + 'AuthAccessToken'; }
    authRefreshTokenName() { return this.name + 'AuthRefreshToken'; }
    authExpirationName() { return this.name + 'AuthExpiration'; }
    followsName() { return this.name + 'Follows'; }
    timeFollowsRefreshedName() { return this.name + 'TimeFollowsRefreshed'; }
    linkMsg() { return this.name + 'Link'; }
    removeMsg() { return this.name + 'Remove'; }
    readyMsg() { return this.name + 'Ready'; }
    refreshFollowsMsg() { return this.name + 'RefreshFollows'; }
    followsRefreshedMsg() { return this.name + 'FollowsRefreshed'; }
    loadAuth(callback)
    {
        chrome.storage.local.get([this.authAccessTokenName(), this.authRefreshTokenName(), this.authExpirationName()], (items) =>
        {
            if (this.authAccessTokenName() in items && this.authRefreshTokenName() in items && this.authExpirationName() in items)
            {
                this.accessToken = items[this.authAccessTokenName()];
                this.refreshToken = items[this.authRefreshTokenName()];
                this.expiration = items[this.authExpirationName()];
                callback(this.accessToken != null && this.refreshToken != null && this.expiration != null);
            }
            else
                callback(false);
        });
    }
    saveAuth(access, refresh, expiresIn, callback)
    {
        this.accessToken = access;
        this.refreshToken = refresh;
        this.expiration = Date.now() + expiresIn * 1000;
        chrome.storage.local.set({[this.authAccessTokenName()]: this.accessToken, [this.authRefreshTokenName()]: this.refreshToken, [this.authExpirationName()]: this.expiration}, () =>
        {
            LOG("saved auth", this.name);
            callback();
        });
    }
    resetStoredAuth(callback)
    {
        this.saveAuth(null, null, 0, callback);
        this.clearFollows(()=>{});
    }
    loadFollows(callback)
    {
        chrome.storage.local.get([this.followsName(), this.timeFollowsRefreshedName()], (items) =>
        {
            if (this.followsName() in items && this.timeFollowsRefreshedName() in items)
            {
                this.follows = items[this.followsName()];
                this.timeFollowsRefreshed = items[this.timeFollowsRefreshedName()];
                callback(this.follows != null && this.timeFollowsRefreshed != null);
            }
            else
                callback(false);
        });
    }
    saveFollows(follows, callback)
    {
        this.follows = follows;
        this.timeFollowsRefreshed = Date.now();
        chrome.storage.local.set({[this.followsName()]: this.follows, [this.timeFollowsRefreshedName()]: this.timeFollowsRefreshed}, () =>
        {
            LOG("saved follows", this.name);
            callback();
        });
    }
    clearFollows(callback)
    {
        this.follows = [];
        this.timeFollowsRefreshed = 0;
        chrome.storage.local.set({[this.followsName()]: this.follows, [this.timeFollowsRefreshedName()]: this.timeFollowsRefreshed}, () =>
        {
            LOG("cleared follows", this.name);
            callback();
        });
    }
    getAdditionalCodeUriParams(){ return {}; }
    getCodeUrl()
    {
        return Misc.getUrl(this.authUri, {...{client_id: this.clientId, redirect_uri: this.redirectUri, response_type: 'code', scope: this.scope}, ...this.getAdditionalCodeUriParams()});
    }
    authorize(callback)
    {
        let self = this;
        this.error = '';
        function authCodeListener(tabId, changeInfo, tab)
        {
            if(tab.url.indexOf(Constants.OAuthCallbackName) === -1 || tab.url.indexOf('code=') === -1 || tab.url.indexOf('two_factor') !== -1)
                return;
            let code = Misc.getUrlParam(tab.url, 'code');
            DEBUG(LOG('got code', self.name, code));
            chrome.tabs.onUpdated.removeListener(authCodeListener);
            chrome.tabs.remove(tab.id);
            Misc.fetchPost(self.tokenUri, {client_id: self.clientId, client_secret: self.clientSecret, code: code, grant_type: 'authorization_code', redirect_uri: self.redirectUri}, {}, (res, error)=>
            {
                DEBUG(LOG(self.name, res));
                if (error)
                {
                    self.error = 'authorization code';
                    callback(false);
                }
                else
                    self.saveAuth(res.access_token, res.refresh_token, res.expires_in, ()=>{ callback(true); });
            });
        }
        chrome.tabs.onUpdated.addListener(authCodeListener);
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs)
                authCodeListener(null, null, tab);
        });
    }
    refreshFollows(callback)
    {
        this.loadAuth((res)=>
        {
            if (!res)
            {
                LOG(this.name, 'not linked');
                callback();
                return;
            }
            this.loadFollows((res)=>
            {
                if (res && Date.now() < this.timeFollowsRefreshed + Constants.RefreshFollowTime)
                {
                    LOG('Not refreshing.', this.name + ' refreshed ' + String((Date.now() - this.timeFollowsRefreshed)/1000) + ' seconds ago');
                    callback();
                    return;
                }
                this.error = '';
                if (Date.now() >= this.expiration)
                {
                    LOG('expired', this.name);
                    Misc.fetchPost(this.tokenUri, {client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'refresh_token', refresh_token: this.refreshToken}, {}, (res, error)=>
                    {
                        DEBUG(LOG(this.name, res));
                        if (error)
                        {
                            self.error = 'refresh token';
                            callback();
                        }
                        else
                            this.saveAuth(res.access_token, (!res.refresh_token || res.refresh_token.length === 0) ? this.refreshToken : res.refresh_token, res.expires_in, ()=>{ this.refreshFollows(callback); });
                    });
                }
                else
                {
                    LOG(this.name, 'starting requests');
                    this.startRequests(callback);
                }
            });
        });
    }
    updateFollowData(follows, matchKey, matchValue, updateData)
    {
        let matches = [];
        for (let f of follows)
            if (f[matchKey] === matchValue)
                matches.push(f);
        for (let f of matches)
            for (let key in updateData)
                f[key] = updateData[key];
    }
    startRequests(callback){}
    makeRequest(url, params, resCallback, errorCallback)
    {
        Misc.fetchGet(url, params, {'Authorization': 'Bearer ' + this.accessToken}, (res, error)=>
        {
            DEBUG(LOG(this.name, res));
            if (error)
            {
                this.error = 'request';
                errorCallback();
            }
            else
                resCallback(res);
        });
    }
    makeRequestHtml(url, params, resCallback, errorCallback)
    {
        Misc.fetchHtml(url, params, (res, error)=>
        {
            DEBUG(LOG(this.name, res));
            if (error)
            {
                this.error = 'requesthtml';
                errorCallback();
            }
            else
                resCallback(res);
        });
    }
}

class Twitch extends Agent
{
    constructor()
    {
        super();
        this.name = 'Twitch';
        this.authUri = 'https://id.twitch.tv/oauth2/authorize';
        this.tokenUri = 'https://id.twitch.tv/oauth2/token';
        this.clientId = Keys.TwitchClientId;
        this.clientSecret = Keys.TwitchClientSecret;
        this.redirectUri = 'http://localhost/' + Constants.OAuthCallbackName;
    }
    startRequests(callback)
    {
        this.makeRequest('https://api.twitch.tv/helix/users', {}, (res) =>
        {
            let self = this;
            let userId = res.data[0].id;
            let page = '';
            let follows = [];
            function getFollowPage()
            {
                self.makeRequest('https://api.twitch.tv/helix/users/follows', {from_id: userId, first: 100, after: page}, (res) =>
                {
                    for (let user of res.data)
                        follows.push(new Follow({userId: user.to_id}));
                    if (!Misc.objectEmpty(res.pagination))
                    {
                        page = res.pagination.cursor;
                        getFollowPage();
                    }
                    else
                        getStreamPage(0);
                }, callback);
            }
            function getStreamPage(streamFollowIndex)
            {
                if (streamFollowIndex < follows.length)
                {
                    const MaxItems = 100;
                    let currentFollows = follows.slice(streamFollowIndex, MaxItems);
                    let usersUrl = 'https://api.twitch.tv/helix/users?';
                    let streamsUrl = 'https://api.twitch.tv/helix/streams?';
                    for (let f of currentFollows)
                    {
                        usersUrl += 'id=' + f.userId + '&';
                        streamsUrl += 'user_id=' + f.userId + '&';
                    }
                    self.makeRequest(usersUrl, {}, (res) =>
                    {
                        for (let d of res.data)
                            self.updateFollowData(follows, 'userId', d.id, {userName: d.display_name, avatarUrl: d.profile_image_url, link: 'https://www.twitch.tv/' + d.login});
                        self.makeRequest(streamsUrl, {}, (res) =>
                        {
                            let gamesUrl = 'https://api.twitch.tv/helix/games?';
                            for (let d of res.data)
                            {
                                self.updateFollowData(follows, 'userId', d.user_id, {activityId: d.game_id, online: d.type === 'live', viewerCount: d.viewer_count});
                                gamesUrl += 'id=' + d.game_id + '&';
                            }
                            self.makeRequest(gamesUrl, {}, (res) =>
                            {
                                for (let d of res.data)
                                    self.updateFollowData(follows, 'activityId', d.id, {activityName: d.name});
                                getStreamPage(streamFollowIndex + MaxItems);
                            }, callback);
                        }, callback);
                    }, callback);
                }
                else
                    self.saveFollows(follows, ()=>{ callback(); });
            }
            getFollowPage();
        }, callback);
    }
}

class Mixer extends Agent
{
    constructor()
    {
        super();
        this.name = 'Mixer';
        this.authUri = 'https://mixer.com/oauth/authorize';
        this.tokenUri = 'https://mixer.com/api/v1/oauth/token';
        this.clientId = Keys.MixerClientId;
        this.clientSecret = Keys.MixerClientSecret;
        this.redirectUri = 'https://' + Constants.OAuthCallbackName;
        this.scope = 'channel:details:self';
    }
    startRequests(callback)
    {
        this.makeRequest('https://mixer.com/api/v1/users/current', {}, (res) =>
        {
            let self = this;
            let follows = [];
            function getFollowPage(page)
            {
                self.makeRequest('https://mixer.com/api/v1/users/' + res.id + '/follows', {page: page, limit: 100}, (res) =>
                {
                    DEBUG(LOG(self.name, res));
                    for (let r of res)
                        follows.push(new Follow({userName: r.user.username, activityName: r.type.name, avatarUrl: r.user.avatarUrl, online: r.online, viewerCount: r.viewersCurrent, link: 'https://mixer.com/' + r.user.username}));
                    if (!Misc.objectEmpty(res))
                        getFollowPage(page + 1);
                    else
                        self.saveFollows(follows, ()=>{ callback(); });
                }, callback);
            }
            getFollowPage(0);
        }, callback);
    }
}

class YouTube extends Agent
{
    constructor()
    {
        super();
        this.name = 'YouTube';
        this.authUri = 'https://accounts.google.com/o/oauth2/v2/auth';
        this.tokenUri = 'https://oauth2.googleapis.com/token';
        this.apiKey = Keys.YouTubeApiKey;
        this.clientId = Keys.YouTubeClientId;
        this.clientSecret = Keys.YouTubeClientSecret;
        this.redirectUri = 'http://localhost/' + Constants.OAuthCallbackName;
        this.scope = 'https://www.googleapis.com/auth/youtube.readonly';
    }
    getAdditionalCodeUriParams()
    {
        return {access_type: 'offline'};
    }
    startRequests(callback)
    {
        let self = this;
        let follows = [];
        function getSubscriptionPage(page)
        {
            self.makeRequest('https://www.googleapis.com/youtube/v3/subscriptions', {part: 'snippet', mine: true, key: self.apiKey, maxResults: 50, pageToken: page}, (res) =>
            {
                DEBUG(LOG(self.name, res));
                for (let i of res.items)
                    follows.push(new Follow({channelId: i.snippet.resourceId.channelId, userName: i.snippet.title, avatarUrl: i.snippet.thumbnails.default.url, link: 'https://www.youtube.com/channel/' + i.snippet.resourceId.channelId}));
                if ('nextPageToken' in res && res['nextPageToken'] !== undefined && res['nextPageToken'].length > 0)
                    getSubscriptionPage(res['nextPageToken']);
                else
                    getFollowHtmls();
            }, callback);
        }
        function getFollowHtmls()
        {
            let numResults = 0;
            for (let f of follows)
            {
                function end()
                {
                    numResults++;
                    if (numResults >= follows.length)
                        self.saveFollows(follows, ()=>{ callback(); });
                }
                self.makeRequestHtml('https://www.youtube.com/channel/' + f.channelId, {}, (res) =>
                {
                    DEBUG(LOG(self.name, res));
                    function testIndex(index)
                    {
                        if (index === -1)
                        {
                            end();
                            return false;
                        }
                        return true;
                    }
                    let numStartStr = '"viewCountText":{"runs":[{"text":"';
                    let numEndStr = ' watching';
                    let vidStartStr = '"videoId":"';
                    let vidEndStr = '"';
                    let titleStartStr = '}},"simpleText":"';
                    let titleEndStr = '"';
                    let numStartIndex = res.indexOf(numStartStr);
                    if (!testIndex(numStartIndex))
                        return;
                    let numEndIndex = res.indexOf(numEndStr, numStartIndex + numStartStr.length);
                    if (!testIndex(numEndIndex))
                        return;
                    let vidStartIndex = res.indexOf(vidStartStr, numEndIndex + numEndStr.length);
                    if (!testIndex(vidStartIndex))
                        return;
                    let vidEndIndex = res.indexOf(vidEndStr, vidStartIndex + vidStartStr.length);
                    if (!testIndex(vidEndIndex))
                        return;
                    let titleStartIndex = res.lastIndexOf(titleStartStr, numStartIndex);
                    if (titleStartIndex !== -1)
                    {
                        let titleEndIndex = res.indexOf(titleEndStr, titleStartIndex + titleStartStr.length);
                        if (titleEndIndex !== -1)
                            f.activityName = res.substring(titleStartIndex + titleStartStr.length, titleEndIndex);
                    }
                    f.online = true;
                    f.viewerCount = Number(res.substring(numStartIndex + numStartStr.length, numEndIndex).replace(',', ''));
                    f.link = 'https://www.youtube.com/watch?v=' + res.substring(vidStartIndex + vidStartStr.length, vidEndIndex);
                    end();
                }, () =>
                {
                    end();
                });
            }
        }
        getSubscriptionPage('');
    }
}

class AgentManager
{
    constructor()
    {
        this.agents = [new Mixer(), new Twitch(), new YouTube()];
    }
    getError()
    {
        for (let a of this.agents)
            if (a.error.length > 0)
                return a.name + ' ' + a.error + ' error. Please try to Link again in the Settings.';
        return '';
    }
}

module.exports = {
    AgentManager: AgentManager
}
