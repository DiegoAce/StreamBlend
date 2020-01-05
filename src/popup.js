'use strict';

const {LOG} = require('./log');
const Misc = require('./misc');
const Constants = require('./constants');
const Agents = require('./agents');
let agentManager = new Agents.AgentManager();

let loaderElement = document.getElementById('loaderId');
let channelsElement = document.getElementById('channelsId');
let errorTextElement = document.getElementById('errorTextId');
let noStreamTextElement = document.getElementById('noStreamTextId');

let gearButton = document.getElementById('gearId');
gearButton.addEventListener("click", (event)=>
{
    chrome.tabs.create({url: 'options.html'});
});

chrome.storage.local.get([Constants.DarkModeName], (items) =>
{
    if (Constants.DarkModeName in items && items[Constants.DarkModeName] != null)
        document.body.className = items[Constants.DarkModeName] ? 'darkTheme' : 'lightTheme';
});

function updateFollowElements()
{
    let follows = [];
    for (let a of agentManager.agents)
        follows = [...follows, ...a.follows];
    follows.sort((f1, f2)=>{ return f1.online && f2.online ? f2.viewerCount - f1.viewerCount : (f2.online ? 1 : -1); });
    while (channelsElement.firstChild)
        channelsElement.removeChild(channelsElement.firstChild);
    for (let f of follows)
    {
        let element = document.createElement('div');
        element.innerHTML = '<div class="button"> \
                                <img class="avatar' + (f.online ? '' : ' offline') + '" src="' + f.avatarUrl + '" alt=""> \
                                <div class="innerText"> \
                                    <span class="userName">' + f.userName + '</span><br/> \
                                    ' + (f.online ? '<span class="activityName">' + f.activityName + '</span>' : '') + '\
                                </div> \
                                <span class="rightText">' + (f.online ? Misc.abbreviateNumber(f.viewerCount) : 'Offline') + '</span> \
                            </div>';
        element.addEventListener("click", (event)=>
        {
            chrome.tabs.query({currentWindow: true, active: true}, (tabs)=> {
                chrome.tabs.update(tabs[0].id, {url: f.link});
            });
        });
        channelsElement.appendChild(element);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>
{
    LOG("popup received message:", request.type);
    switch (request.type)
    {
    case Constants.ErrorTextMsg:
        errorTextElement.style.display = request.message.length > 0 ? 'inline-block' : 'none';
        errorTextElement.textContent = request.message;
        break;
    default:
        for (let a of agentManager.agents)
        {
            if (request.type === a.followsRefreshedMsg())
            {
                a.refreshingFollows = false;
                let anyRefreshing = agentManager.agents.find((a2) => { return a2.refreshingFollows; });
                a.loadFollows((result)=>
                {
                    updateFollowElements();
                    if (!anyRefreshing)
                        loaderElement.style.display = 'none';
                    if (!anyRefreshing && !channelsElement.firstChild)
                    {
                        LOG(anyRefreshing, channelsElement.firstChild);
                        noStreamTextElement.style.display = 'inline-block';
                    }
                });
            }
        }
        break;
    }
    sendResponse({});
});

for (let a of agentManager.agents)
{
    a.refreshingFollows = true;
    chrome.runtime.sendMessage({type: a.refreshFollowsMsg()}, (response)=>{});
}
