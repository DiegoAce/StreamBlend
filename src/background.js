'use strict';

const {LOG} = require('./log');
const Constants = require('./constants');
const Agents = require('./agents');
let agentManager = new Agents.AgentManager();
let contentTabId = 0;
let optionsTabId = 0;

function checkChromeError()
{
    if (chrome.runtime.lastError)
        LOG(chrome.runtime.lastError.message);
}

function updateError()
{
    let error = agentManager.getError();
    if (error.length > 0)
    {
        chrome.browserAction.setBadgeBackgroundColor({ color: [200, 0, 0, 255] });
        chrome.browserAction.setBadgeText({text: '!'});
    }
    else
        chrome.browserAction.setBadgeText({text: ''});
    chrome.runtime.sendMessage({type: Constants.ErrorTextMsg, message: error}, (response)=>{ checkChromeError(); });
}

function refreshAgentFollows(a)
{
    a.refreshFollows(()=>
    {
        chrome.tabs.sendMessage(contentTabId, {type: a.followsRefreshedMsg()}, (response)=>{ checkChromeError(); });
        chrome.runtime.sendMessage({type: a.followsRefreshedMsg()}, (response)=>{ checkChromeError(); });
        updateError();
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    LOG("background received message:", request.type);
    switch (request.type)
    {
    case Constants.ContentTabIdMsg:
        contentTabId = sender.tab.id;
        break;
    case Constants.OptionsTabIdMsg:
        optionsTabId = sender.tab.id;
        break;
    default:
        for (let a of agentManager.agents)
        {
            if (request.type === a.linkMsg())
            {
                a.authorize((result)=>
                {
                    if (result)
                    {
                        chrome.tabs.sendMessage(optionsTabId, {type: a.readyMsg()}, (response)=>{ checkChromeError(); });
                        refreshAgentFollows(a);
                    }
                    updateError();
                });
            }
            else if (request.type === a.removeMsg())
            {
                a.error = '';
                updateError();
            }
            else if (request.type === a.refreshFollowsMsg())
                refreshAgentFollows(a);
        }
        break;
    }
    sendResponse({});
});
