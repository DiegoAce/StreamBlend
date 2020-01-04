'use strict';

const {LOG} = require('./log');
const Constants = require('./constants');
const Agents = require('./agents');
let agentManager = new Agents.AgentManager();

document.getElementById('refreshFollowsId').onclick = (element)=>
{
    for (let a of agentManager.agents)
        a.clearFollows(()=>{ chrome.runtime.sendMessage({type: a.refreshFollowsMsg()}, (response)=>{}); });
};
document.getElementById('githubId').onclick = (element)=>{ chrome.tabs.create({url: 'https://github.com/DiegoAce/StreamBlend'}); };
document.getElementById('donateId').onclick = (element)=>{ chrome.tabs.create({url: 'https://www.paypal.me/DiegoAce'}); };
document.getElementById('darkModeId').onclick = (element)=>{ setColorTheme(true); };

function setColorTheme(toggle)
{
    chrome.storage.local.get([Constants.DarkModeName], (items) =>
    {
        let dark = Constants.DarkModeName in items && items[Constants.DarkModeName] != null ? items[Constants.DarkModeName] : false;
        if (toggle)
            dark = !dark;
        document.body.className = dark ? 'darkTheme' : 'lightTheme';
        chrome.storage.local.set({[Constants.DarkModeName]: dark}, ()=>{});
    });
}
setColorTheme(false);

for (let a of agentManager.agents)
{
    a.linkButton = document.getElementById('link' + a.name);
    a.linkButton.onclick = (element)=>
    {
        chrome.runtime.sendMessage({type: a.linkMsg()}, (response)=>{});
        chrome.tabs.create({url: a.getCodeUrl()});
    };
    a.removeButton = document.getElementById('remove' + a.name);
    a.removeButton.onclick = (element)=>
    {
        chrome.runtime.sendMessage({type: a.removeMsg()}, (response)=>{});
        a.resetStoredAuth(()=>{ setButtons(); });
    };
}

function setButtons()
{
    for (let a of agentManager.agents)
    {
        a.loadAuth((result) =>
        {
            a.linkButton.style.display = result ? 'none' : 'inline-block';
            a.removeButton.style.display = result ? 'inline-block' : 'none';
        });
    }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
    LOG("options received message:", request.type);
    switch (request.type)
    {
    default:
        for (let a of agentManager.agents)
        {
            if (request.type === a.readyMsg())
            {
                setButtons();
            }
        }
        break;
    }
    sendResponse({});
});

chrome.runtime.sendMessage({type: Constants.OptionsTabIdMsg}, (response)=>{});
setButtons();
