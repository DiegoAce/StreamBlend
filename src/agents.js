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
            this['set' + varName] = (x)=>{ return Misc.setStorage(this.name + varName, x); }
            this['get' + varName] = ()=>{ return Misc.getStorage(this.name + varName); }
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
    async getImage(dark) { return this.name.toLowerCase() + '.svg'; }
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
            await this.setError('');
            await this.hiddenAuthorize();
            follows = await this.getNewFollows();
        }
        if (follows)
        {
            if (await Misc.getStorage(Constants.HideOfflineName))
                follows = follows.filter((f)=>{ return f.online; });
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
        this.clientId = 'vc9ta3qi9it37arr8en37ovx1hgmvl';
        this.connectType = ConnectType.OAuth;
    }
    async getAuthUrl()
    {
        let params = {client_id: this.clientId, redirect_uri: 'https://streamblend.github.io/oauth', response_type: 'token', scope: 'user:read:email'};
        return Misc.getUrl('https://id.twitch.tv/oauth2/authorize', params);
    }
    async setAuth(url)
    {
        let token = Misc.getUrlParam(url, 'access_token');
        if (!token)
            return await this.setOAuthError();
        LOG(this.name, 'got token', token);
        let response = await Misc.fetchGet('https://id.twitch.tv/oauth2/validate', {}, {'Authorization': 'OAuth ' + token});
        if (!response || !response.login || !response.user_id)
            return await this.setOAuthError();
        await this.setAccessToken(token);
        await this.setUserName(response.login);
        await this.setUserId(response.user_id);
    }
    async getNewFollows()
    {
        let userId = await this.getUserId();
        let headers = {'Client-ID': this.clientId, 'Authorization': 'Bearer ' + await this.getAccessToken()}
        let follows = [];
        let getFollowPage = async (page)=>
        {
            let response = await Misc.fetchGet('https://api.twitch.tv/helix/users/follows', {from_id: userId, first: 100, after: page}, headers);
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
                let currentFollows = follows.slice(streamFollowIndex, streamFollowIndex + MaxItems);
                let usersUrl = 'https://api.twitch.tv/helix/users?';
                let streamsUrl = 'https://api.twitch.tv/helix/streams?';
                for (let f of currentFollows)
                {
                    usersUrl += 'id=' + f.userId + '&';
                    streamsUrl += 'user_id=' + f.userId + '&';
                }
                let response = await Misc.fetchGet(usersUrl, {}, headers);
                if (!response)
                    return await this.setFollowError();
                for (let d of response.data)
                    Misc.updateMatchingObjects(follows, 'userId', d.id, {userName: d.display_name, avatarUrl: d.profile_image_url, link: 'https://www.twitch.tv/' + d.login});
                response = await Misc.fetchGet(streamsUrl, {}, headers);
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
                    response = await Misc.fetchGet(gamesUrl, {}, headers);
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
        this.headers = {'Client-ID': 'e5e7f2d486725a7896b21e508ac6c828ee592c03fb93345e'};
    }
    async getImage(dark)
    {
        return 'mixer' + (dark ? 'Dark' : 'Light') + '.svg';
    }
    async setAuth(userName)
    {
        let response = await Misc.fetchGet('https://mixer.com/api/v1/channels/' + userName, {}, this.headers);
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
            let response = await Misc.fetchGet('https://mixer.com/api/v1/users/' + userId + '/follows', {page: page, limit: 100}, this.headers);
            if (!response)
                return await this.setFollowError();
            for (let r of response)
            {
                if (r.user && r.user.username && r.user.avatarUrl)
                {
                    follows.push(new Follow({userName: r.user.username, avatarUrl: r.user.avatarUrl, link: 'https://mixer.com/' + r.user.username}));
                    if (r.type && r.type.name)
                        follows[follows.length - 1].activityName = r.type.name;
                    if (r.online)
                        follows[follows.length - 1].online = r.online;
                    if (r.viewersCurrent)
                        follows[follows.length - 1].viewerCount = r.viewersCurrent;
                }
            }
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

class Smashcast extends Agent
{
    constructor()
    {
        super('Smashcast');
        this.userNameDescription = 'username';
    }
    async setAuth(userName)
    {
        let response = await Misc.fetchGet('https://api.smashcast.tv/user/' + userName, {}, {});
        if (!response || !response.user_name)
            return await this.setUserNameError();
        await this.setUserName(response.user_name);
    }
    async getNewFollows()
    {
        let username = await this.getUserName();
        let follows = [];
        const MaxCount = 100;
        let getFollowPage = async (index)=>
        {
            let response = await Misc.fetchGet('https://api.smashcast.tv/following/user', {user_name: username, offset: index, limit: MaxCount}, {});
            if (!response || !response.following || (!response.max_results && Number(response.max_results) !== 0))
                return await this.setFollowError();
            if (!Number(response.max_results))
                return follows;
            
            let mediaUrl = 'https://api.smashcast.tv/media/live/';
            for (let f of response.following)
            {
                if (f.user_name && f.user_logo_small)
                {
                    follows.push(new Follow({userName: f.user_name, avatarUrl: 'http://edge.sf.hitbox.tv' + f.user_logo_small, link: 'https://www.smashcast.tv/' + f.user_name}));
                    mediaUrl += f.user_name + ',';
                }
            }
            
            let mediaResponse = await Misc.fetchGet(mediaUrl, {}, {});
            if (!mediaResponse || !mediaResponse.livestream)
                return await this.setFollowError();
            for (let l of mediaResponse.livestream)
                Misc.updateMatchingObjects(follows, 'userName', l.media_user_name, {online: l.media_is_live === '1', viewerCount: l.media_views ? Number(l.media_views) : 0, activityName: l.category_name ? l.category_name : ''});
            
            index += MaxCount;
            if (index < Number(response.max_results))
                return await getFollowPage(index);
            else
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
        let params = {client_id: '692437206912-o65sokucfei9f74gjbu7ppf6sprci07k.apps.googleusercontent.com', redirect_uri: 'https://sites.google.com/site/streamblend/oauth', response_type: 'token', scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/youtube.readonly', prompt: 'select_account'};
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

class Facebook extends Agent
{
    constructor()
    {
        super('Facebook');
    }
    async getNewFollows()
    {
//        let name = 'disguisedtoast';
//        let online = false;
//        let activity = '';
//        let response = await Misc.fetchHtml('https://m.facebook.com/' + name + '/live', {}, {});
//        LOG(response);
//        LOG(JSON.stringify(response).length);
//        var element = document.createElement('html');
//        element.innerHTML = response;
//        let videoElements = element.getElementsByClassName('_52ja');
//        if (videoElements.length > 0)
//        {
//            let liveIndex = videoElements[0].innerText.indexOf('is live now');
//            online = liveIndex !== -1;
//            let playingStr = 'playing ';
//            let playingIndex = videoElements[0].innerText.indexOf(playingStr);
//            if (playingIndex !== -1)
//            {
//                let periodIndex = videoElements[0].innerText.indexOf('.', playingIndex + playingStr.length);
//                activity = videoElements[0].innerText.substring(playingIndex + playingStr.length, periodIndex === -1 ? playingIndex + 30 : periodIndex);
//            }
//        }
//        LOG(name, online, activity);
    }
}

let twitch = new Twitch();

module.exports = {
    agents: [new Mixer(), twitch, new DLive(), new Smashcast(), new YouTube()],
    twitch: twitch,
    ConnectType: ConnectType
}
