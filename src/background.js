'use strict';

const LOG = require('./log');
const Misc = require('./misc');
const Constants = require('./constants');
let {agents} = require('./agents');
let tabIds = {};

async function setBadge()
{
    for (let a of agents)
    {
        if (await a.getError())
        {
            chrome.browserAction.setBadgeBackgroundColor({ color: [200, 0, 0, 255] });
            chrome.browserAction.setBadgeText({text: '!'});
            return;
        }
    }
    if (!(await Misc.getStorage(Constants.HideCountBadgeName)))
    {
        let count = 0;
        for (let a of agents)
        {
            let follows = await a.getFollows();
            if (follows && follows.length > 0)
                for (let f of follows)
                    if (f.online)
                        count++;
        }
        chrome.browserAction.setBadgeBackgroundColor({ color: [100, 100, 100, 255] });
        chrome.browserAction.setBadgeText({text: String(count)});
        return;
    }
    chrome.browserAction.setBadgeText({text: ''});
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) =>
{
    LOG("background received message:", request.type);
    switch (request.type)
    {
    case Constants.TwitchTabIdMsg:
        tabIds.twitch = sender.tab.id;
        break;
    case Constants.MixerTabIdMsg:
        tabIds.mixer = sender.tab.id;
        break;
    case Constants.OptionsTabIdMsg:
        tabIds.options = sender.tab.id;
        break;
    default:
        for (let a of agents)
        {
            switch (request.type)
            {
            case a.msgRefreshFollows:
                await a.refreshFollows();
                await setBadge();
                a.sendMsgFollowsRefreshed(tabIds);
                break;
            default:
                break;
            }
        }
        break;
    }
    sendResponse({});
});

chrome.storage.onChanged.addListener(async (changes, areaName) =>
{
    for (let key in changes)
    {
        for (let a of agents)
        {
            switch (key)
            {
            case a.varError:
                a.sendMsgError(tabIds);
                await setBadge();
                break;
            default:
                break;
            }
        }
        switch (key)
        {
        case Constants.HideCountBadgeName:
            await setBadge();
            break;
        default:
            break;
        }
    }
});

let oauthIFrameElement = document.createElement('iframe');
oauthIFrameElement.id = Constants.OAuthIFrameId;
document.body.appendChild(oauthIFrameElement);
setBadge();
for (let a of agents)
    a.setRefreshingFollows(false);

