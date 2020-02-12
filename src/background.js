'use strict';

const LOG = require('./log');
const Misc = require('./misc');
const Constants = require('./constants');
let {agents} = require('./agents');
let tabIds = {};

async function setErrorBadge()
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
                await setErrorBadge();
                break;
            default:
                break;
            }
        }
    }
});

let oauthIFrameElement = document.createElement('iframe');
oauthIFrameElement.id = Constants.OAuthIFrameId;
document.body.appendChild(oauthIFrameElement);
setErrorBadge();
for (let a of agents)
    a.setRefreshingFollows(false);

