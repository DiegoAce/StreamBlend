'use strict';

const LOG = require('./log');
const Constants = require('./constants');
const Misc = require('./misc');

const ConnectType = Object.freeze({
    UserName: 1,
    OAuth: 2
});

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
        this.userNameDescription = '';
        for (let key in obj)
          this[key] = obj[key];
    }
}

class Agent
{
    constructor(name)
    {
        this.name = name;
        this.connectType = ConnectType.UserName;
        for (let varName of ['Error', 'UserName', 'UserId', 'AccessToken', 'Follows', 'TimeFollowsRefreshed', 'RefreshingFollows'])
        {
            this['var' + varName] = this.name + varName;
            this['set' + varName] = (x)=>{ return new Promise((resolve)=>{ chrome.storage.local.set({[this.name + varName]: x}, ()=>{ LOG('set' + this.name + varName, x); resolve(); }); }); }
            this['get' + varName] = ()=>{ return new Promise((resolve)=>{ chrome.storage.local.get([this.name + varName], (obj)=>{ LOG('get' + this.name + varName, Object.values(obj)[0]); resolve(Object.values(obj)[0]); }); }); }
        }
        for (let varName of ['Error', 'RefreshFollows', 'FollowsRefreshed'])
        {
            this['msg' + varName] = this.name + varName;
            this['sendMsg' + varName] = (tabIds)=>
            {
                chrome.runtime.sendMessage({type: this.name + varName});
                if (tabIds)
                    for (let tabId of Object.values(tabIds))
                        chrome.tabs.sendMessage(tabId, {type: this.name + varName});
            }
        }
    }
    async setOAuthError() { await this.setError(this.name + ' authentication error.'); }
    async setUserNameError() { await this.setError(this.name + ' ' + this.userNameDescription + ' not found.'); }
    async setFollowError() { await this.setError(this.name + ' could not get follows. Try again later or try reconnecting the account.'); }
    async authorize(data)
    {
        await this.setError('');
        await this.setRefreshingFollows(false);
        await this.setAuth(data);
    }
    async hiddenAuthorize()
    {
        return new Promise(async (resolve)=>
        {
            let oauthIFrameElement = document.getElementById(Constants.OAuthIFrameId);
            if (!oauthIFrameElement)
                return resolve();
            let listener = async (request, sender, sendResponse)=>
            {
                if (request.type === Constants.OAuthMsg)
                {
                    chrome.runtime.onMessage.removeListener(listener);
                    await this.authorize(sender.url);
                    resolve();
                }
            };
            chrome.runtime.onMessage.addListener(listener);
            oauthIFrameElement.src = await this.getAuthUrl();
        });
    }
    async refreshFollows()
    {
        if (!(await this.getUserName()))
        {
            LOG(this.name, 'not connected');
            await this.setFollows([]);
            return
        }
        let timeFollowsRefreshed = await this.getTimeFollowsRefreshed();
        if (timeFollowsRefreshed && Date.now() < timeFollowsRefreshed + 5 * 60 * 1000)
            return LOG(this.name, 'Not refreshing. Refreshed ' + String((Date.now() - timeFollowsRefreshed)/1000) + ' seconds ago');
        if (await this.getRefreshingFollows())
            return LOG(this.name, 'currently refreshing');
        await this.setRefreshingFollows(true);
        await this.setError('');
        let follows = await this.getNewFollows();
        if (!follows && this.connectType === ConnectType.OAuth)
        {
            await this.hiddenAuthorize();
            follows = await this.getNewFollows();
        }
        if (follows)
        {
            await this.setFollows(follows);
            await this.setTimeFollowsRefreshed(Date.now());
        }
        await this.setRefreshingFollows(false);
    }
}

class Twitch extends Agent
{
    constructor()
    {
        super('Twitch');
        this.userNameDescription = 'login name';
        this.headers = {'Client-ID': 'vc9ta3qi9it37arr8en37ovx1hgmvl'};
    }
    async setAuth(userName)
    {
        let response = await Misc.fetchGet('https://api.twitch.tv/helix/users', {login: userName}, this.headers);
        if (!response || !response.data || !response.data[0] || !response.data[0].login || !response.data[0].id)
            return await this.setUserNameError();
        await this.setUserName(response.data[0].login);
        await this.setUserId(response.data[0].id);
    }
    async getNewFollows()
    {
        let userId = await this.getUserId();
        let follows = [];
        let getFollowPage = async (page)=>
        {
            let response = await Misc.fetchGet('https://api.twitch.tv/helix/users/follows', {from_id: userId, first: 100, after: page}, this.headers);
            if (!response)
                return await this.setFollowError();
            for (let user of response.data)
                follows.push(new Follow({userId: user.to_id}));
            if (response.pagination && response.pagination.cursor)
                return await getFollowPage(response.pagination.cursor);
            else
                return await getStreamPage(0);
        };
        let getStreamPage = async (streamFollowIndex)=>
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
                let response = await Misc.fetchGet(usersUrl, {}, this.headers);
                if (!response)
                    return await this.setFollowError();
                for (let d of response.data)
                    Misc.updateMatchingObjects(follows, 'userId', d.id, {userName: d.display_name, avatarUrl: d.profile_image_url, link: 'https://www.twitch.tv/' + d.login});
                response = await Misc.fetchGet(streamsUrl, {}, this.headers);
                if (!response)
                    return await this.setFollowError();
                if (response.data && response.data.length > 0)
                {
                    let gamesUrl = 'https://api.twitch.tv/helix/games?';
                    for (let d of response.data)
                    {
                        Misc.updateMatchingObjects(follows, 'userId', d.user_id, {activityId: d.game_id, online: d.type === 'live', viewerCount: d.viewer_count});
                        gamesUrl += 'id=' + d.game_id + '&';
                    }
                    response = await Misc.fetchGet(gamesUrl, {}, this.headers);
                    if (!response)
                        return await this.setFollowError();
                    for (let d of response.data)
                        Misc.updateMatchingObjects(follows, 'activityId', d.id, {activityName: d.name});
                }
                return await getStreamPage(streamFollowIndex + MaxItems);
            }
            else
                return follows;
        };
        return await getFollowPage('');
    }
}

class Mixer extends Agent
{
    constructor()
    {
        super('Mixer');
        this.userNameDescription = 'username';
    }
    async setAuth(userName)
    {
        let response = await Misc.fetchGet('https://mixer.com/api/v1/channels/' + userName, {}, {});
        if (!response || !response.userId)
            return await this.setUserNameError();
        await this.setUserName(response.token);
        await this.setUserId(response.userId);
    }
    async getNewFollows()
    {
        let userId = await this.getUserId();
        let follows = [];
        let getFollowPage = async (page)=>
        {
            let response = await Misc.fetchGet('https://mixer.com/api/v1/users/' + userId + '/follows', {page: page, limit: 100}, {});
            if (!response)
                return await this.setFollowError();
            for (let r of response)
                follows.push(new Follow({userName: r.user.username, activityName: r.type.name, avatarUrl: r.user.avatarUrl, online: r.online, viewerCount: r.viewersCurrent, link: 'https://mixer.com/' + r.user.username}));
            if (!Misc.objectEmpty(response))
                return await getFollowPage(page + 1);
            return follows;
        };
        return await getFollowPage(0);
    }
}

class DLive extends Agent
{
    constructor()
    {
        super('DLive');
        this.userNameDescription = 'display name';
    }
    async setAuth(displayName)
    {
        let response = await Misc.fetchPost('https://graphigo.prd.dlive.tv/', {query: 'query{userByDisplayName(displayname: "' + displayName + '") {username displayname}}'}, {});
        if (!response || !response.data || !response.data.userByDisplayName || !response.data.userByDisplayName.displayname)
            return await this.setUserNameError();
        await this.setUserName(response.data.userByDisplayName.displayname);
    }
    async getNewFollows()
    {
        let displayName = await this.getUserName();
        let follows = [];
        let getFollowPage = async (cursor)=>
        {
            let response = await Misc.fetchPost('https://graphigo.prd.dlive.tv/', {query: 'query{userByDisplayName(displayname: "' + displayName + '") {following(first:50 after:"' + cursor + '"){pageInfo{endCursor hasNextPage} list{displayname avatar livestream{watchingCount title category{title}}}}}}'}, {});
            if (!response || !response.data || !response.data.userByDisplayName || !response.data.userByDisplayName.following)
                return await this.setFollowError();
            for (let f of response.data.userByDisplayName.following.list)
                follows.push(new Follow({userName: f.displayname, activityName: f.livestream ? f.livestream.category.title : '', avatarUrl: f.avatar, online: f.livestream, viewerCount: f.livestream ? f.livestream.watchingCount : 0, link: 'https://dlive.tv/' + f.displayname}));
            if (response.data.userByDisplayName.following.pageInfo.hasNextPage)
                return await getFollowPage(response.data.userByDisplayName.following.pageInfo.endCursor);
            return follows;
        };
        return await getFollowPage(0);
    }
}

class YouTube extends Agent
{
    constructor()
    {
        super('YouTube');
        this.connectType = ConnectType.OAuth;
    }
    async getAuthUrl()
    {
        let params = {client_id: '692437206912-o65sokucfei9f74gjbu7ppf6sprci07k.apps.googleusercontent.com', redirect_uri: 'https://streamblend.github.io/oauth', response_type: 'token', scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/youtube.readonly', prompt: 'select_account'};
        let userName = await this.getUserName();
        if (userName)
            params = {...params, ...{prompt: 'none', login_hint: userName}}
        return Misc.getUrl('https://accounts.google.com/o/oauth2/v2/auth', params);
    }
    async setAuth(url)
    {
        let token = Misc.getUrlParam(url, 'access_token');
        if (!token)
            return await this.setOAuthError();
        LOG(this.name, 'got token', token);
        let response = await Misc.fetchGet('https://www.googleapis.com/oauth2/v2/userinfo', {}, {'Authorization': 'Bearer ' + token});
        if (!response || !response.email)
            return await this.setOAuthError();
        await this.setAccessToken(token);
        await this.setUserName(response.email);
    }
    async getNewFollows()
    {
        let token = await this.getAccessToken();
        let follows = [];
        let getSubscriptionPage = async (page)=>
        {
            let response = await Misc.fetchGet('https://www.googleapis.com/youtube/v3/subscriptions', {part: 'snippet', mine: true, maxResults: 50, pageToken: page}, {'Authorization': 'Bearer ' + token});
            if (!response)
                return await this.setFollowError();
            for (let i of response.items)
                follows.push(new Follow({channelId: i.snippet.resourceId.channelId, userName: i.snippet.title, avatarUrl: i.snippet.thumbnails.default.url, link: 'https://www.youtube.com/channel/' + i.snippet.resourceId.channelId}));
            if (response.nextPageToken)
                return await getSubscriptionPage(response.nextPageToken);
            else
                return await getFollowHtmls();
        };
        let getFollowHtmls = async ()=>
        {
            let promises = [];
            let length = follows.length;
            for (let i = 0; i < length; i++)
            {
                promises.push(Misc.fetchHtml('https://m.youtube.com/channel/' + follows[i].channelId + '/videos?view=2&live_view=501&flow=list&app=m', {}, {})
                .then(async (response)=>
                {
                    if (!response)
                        return;
                    let index = 0;
                    let vidStr = 'compactVideoRenderer';
                    while (1)
                    {
                        index = response.indexOf(vidStr, index);
                        if (index === -1)
                            return;
                        index += vidStr.length;
                        let vid;
                        try { vid = JSON.parse(Misc.getEnclosingBracketString(response, index)); }
                        catch(e) { LOG(e); return; }
                        LOG('vid', vid)
                        if (!vid || !vid.videoId || !vid.title || !vid.title.runs || !vid.title.runs[0] || !vid.title.runs[0].text || !vid.viewCountText || !vid.viewCountText.runs || !vid.viewCountText.runs[0] || !vid.viewCountText.runs[0].text || vid.viewCountText.runs[0].text.indexOf('watching') === -1)
                            continue;
                        let properties = {duplicate: true, online: true, viewerCount: Number(vid.viewCountText.runs[0].text.replace(/\D/g,'')), link: 'https://www.youtube.com/watch?v=' + vid.videoId, activityName: vid.title.runs[0].text};
                        if (!follows[i].duplicate)
                            follows[i] = {...follows[i], ...properties};
                        else
                            follows.push(Object.assign({}, {...follows[i], ...properties}));
                    }
                }));
            }
            await Promise.all(promises);
            return follows;
        };
        return await getSubscriptionPage('');
    }
}

class AgentManager
{
    constructor()
    {
        this.agents = [new Mixer(), new Twitch(), new DLive(), new YouTube()];
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
    AgentManager: AgentManager,
    ConnectType: ConnectType
}
