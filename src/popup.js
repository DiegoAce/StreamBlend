'use strict';

const LOG = require('./log');
const Misc = require('./misc');
const Constants = require('./constants');
const Agents = require('./agents');
let agentManager = new Agents.AgentManager();

let loaderElement = document.getElementById('loaderId');
let channelsElement = document.getElementById('channelsId');
let errorElement = document.getElementById('errorId');
let emptyTextElement = document.getElementById('emptyTextId');
let gearButton = document.getElementById('gearId');
gearButton.onclick = (event)=>{ chrome.tabs.create({url: 'options.html'}); };

chrome.storage.local.get([Constants.DarkModeName], (items)=>{ document.body.className = items[Constants.DarkModeName] ? 'darkScheme' : 'lightScheme'; });

async function setErrorElement()
{
    for (let a of agentManager.agents)
    {
        if (await a.getError())
        {
            errorElement.style.display = 'inline';
            return;
        }
    }
    errorElement.style.display = 'none';
}

function updateFollowElements()
{
    let follows = [];
    for (let a of agentManager.agents)
    {
        if (a.follows)
        {
            for (let f of a.follows)
                f.agentName = a.name;
            follows = [...follows, ...a.follows];
        }
    }
    follows.sort((f1, f2)=>{ return f1.online && f2.online ? f2.viewerCount - f1.viewerCount : (f2.online ? 1 : -1); });
    while (channelsElement.firstChild)
        channelsElement.firstChild.remove();
    for (let f of follows)
    {
        let element = document.createElement('div');
        element.innerHTML = '<a class="channel" href="'+f.link+'"> \
                                <img class="avatar' + (f.online ? '' : ' offline') + '" src="' + f.avatarUrl + '" alt=""> \
                                <div class="channelName">' + f.userName + '</div> \
                                <div class="activityName">' + (f.online ? f.activityName : '') + '</div> \
                                <div class="viewerCount">' + (f.online ? Misc.abbreviateNumber(f.viewerCount) : 'Offline') + '</div> \
                                <img class="agentImage" src="images/' + f.agentName.toLowerCase() + '.svg" alt=""> \
                            </a>';
        channelsElement.appendChild(element);
    }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse)=>
{
    LOG("popup received message:", request.type);
    switch (request.type)
    {
    default:
        for (let a of agentManager.agents)
        {
            switch (request.type)
            {
            case a.msgError:
                setErrorElement();
                break;
            case a.msgFollowsRefreshed:
                let anyRefreshing = false;
                for (let a2 of agentManager.agents)
                    anyRefreshing |= await a2.getRefreshingFollows();
                a.follows = await a.getFollows();
                updateFollowElements();
                if (!anyRefreshing)
                    loaderElement.style.display = 'none';
                if (!anyRefreshing || channelsElement.firstChild)
                    emptyTextElement.style.display = channelsElement.firstChild ? 'none' : 'block';
                break;
            default:
                break;
            }
        }
        break;
    }
    sendResponse({});
});

setErrorElement();
for (let a of agentManager.agents)
    a.sendMsgRefreshFollows();
